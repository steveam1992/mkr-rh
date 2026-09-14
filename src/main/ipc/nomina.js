import { BrowserWindow, dialog } from 'electron'
import fs from 'fs'
import { limpiar, oNulo, num, hoy, round2, sumarDias } from '../utils'
import { calcularIsr, cuotaObreroImss, montoHorasExtra, aguinaldoProporcional } from '../lft'
import { DESTINO, ETIQUETA_CONCEPTO, vigentesPara, importeDe } from './conceptos'

const TIPOS = { semanal: 7, catorcenal: 14, quincenal: 15, mensual: 30 }

// Campos del recibo que pueden venir de los conceptos fijos del empleado.
const CAMPOS_CONCEPTO = ['bonos', 'otras_percepciones', 'infonavit', 'fonacot', 'prestamos', 'otras_deducciones']

// Reparte los conceptos vigentes del empleado en los renglones del recibo. Los creditos
// (FONACOT, INFONAVIT, prestamos) se topan a lo que falta por pagar, de modo que el
// ultimo descuento sea el remanente exacto y no se pase.
function conceptosDelPeriodo(db, empleado, periodo, sueldoPeriodo) {
  const campos = {}
  const aplicaciones = []
  let exentas = 0

  for (const concepto of vigentesPara(db, empleado.id, periodo)) {
    if (concepto.liquidado) continue

    const importe = importeDe(concepto, { sueldoPeriodo, saldoDisponible: concepto.saldo })
    if (importe <= 0) continue

    const campo = DESTINO[concepto.clave] || (concepto.tipo === 'percepcion' ? 'otras_percepciones' : 'otras_deducciones')
    campos[campo] = round2((campos[campo] || 0) + importe)
    if (concepto.tipo === 'percepcion' && !concepto.gravable) exentas = round2(exentas + importe)

    aplicaciones.push({ concepto_id: concepto.id, importe })
  }

  return { campos, aplicaciones, exentas }
}

function contexto(db) {
  return {
    cfg: db.prepare('SELECT * FROM configuracion WHERE id = 1').get(),
    tarifa: db.prepare('SELECT * FROM isr_tarifa ORDER BY limite_inferior').all()
  }
}

// Fechas de un evento (vacaciones, incapacidad, permiso) que caen dentro del periodo.
function fechasDentro(inicioEvento, finEvento, inicioPeriodo, finPeriodo) {
  const desde = inicioEvento > inicioPeriodo ? inicioEvento : inicioPeriodo
  const hasta = finEvento < finPeriodo ? finEvento : finPeriodo
  const fechas = []
  let cursor = desde
  while (cursor <= hasta) {
    fechas.push(cursor)
    cursor = sumarDias(cursor, 1)
  }
  return fechas
}

// Se trabaja con conjuntos de fechas, no con sumas de dias: un mismo dia capturado
// como falta en asistencia y como permiso sin goce descontaria dos veces.
function incidenciasDelPeriodo(db, empleado, periodo) {
  const { fecha_inicio: inicio, fecha_fin: fin } = periodo

  const horasExtra = db.prepare(
    `SELECT COALESCE(SUM(horas_extra), 0) AS h FROM asistencia
     WHERE empleado_id = ? AND fecha BETWEEN ? AND ?`
  ).get(empleado.id, inicio, fin).h

  const incapacidades = db.prepare(
    'SELECT * FROM incapacidades WHERE empleado_id = ? AND fecha_inicio <= ? AND fecha_fin >= ?'
  ).all(empleado.id, fin, inicio)
  const diasIncapacidad = new Set(
    incapacidades.flatMap((i) => fechasDentro(i.fecha_inicio, i.fecha_fin, inicio, fin))
  )

  const vacaciones = db.prepare(
    `SELECT * FROM vacaciones WHERE empleado_id = ? AND estatus IN ('aprobada', 'disfrutada')
     AND fecha_inicio <= ? AND fecha_fin >= ?`
  ).all(empleado.id, fin, inicio)
  const diasVacaciones = new Set(
    vacaciones.flatMap((v) => fechasDentro(v.fecha_inicio, v.fecha_fin, inicio, fin))
  )
  const diasPrima = new Set(
    vacaciones.filter((v) => v.pagar_prima)
      .flatMap((v) => fechasDentro(v.fecha_inicio, v.fecha_fin, inicio, fin))
  )

  const permisos = db.prepare(
    `SELECT * FROM permisos
     WHERE empleado_id = ? AND estatus = 'aprobado' AND descuenta = 1
       AND fecha_inicio <= ? AND fecha_fin >= ?`
  ).all(empleado.id, fin, inicio)
  const faltasAsistencia = db.prepare(
    `SELECT fecha FROM asistencia
     WHERE empleado_id = ? AND fecha BETWEEN ? AND ? AND estatus = 'falta'`
  ).all(empleado.id, inicio, fin).map((r) => r.fecha)

  // Una incapacidad o unas vacaciones mandan sobre la falta: ese dia ya se contabiliza aparte.
  const diasFalta = new Set([
    ...permisos.flatMap((p) => fechasDentro(p.fecha_inicio, p.fecha_fin, inicio, fin)),
    ...faltasAsistencia
  ].filter((f) => !diasIncapacidad.has(f) && !diasVacaciones.has(f)))

  return {
    dias_falta: diasFalta.size,
    dias_incapacidad: diasIncapacidad.size,
    dias_vacaciones: diasVacaciones.size,
    dias_prima: diasPrima.size,
    horas_extra: round2(horasExtra)
  }
}

// Recalcula percepciones, deducciones y neto de un recibo. Se usa tanto al generar la
// nomina como cada vez que el usuario edita un importe a mano.
function recalcular(recibo, empleado, { cfg, tarifa }) {
  const sd = num(recibo.salario_diario) || num(empleado.salario_diario)
  const dias = num(recibo.dias_trabajados)
  const uma = num(cfg.uma_diaria, 113.14)

  const sueldo = round2(sd * dias)
  const montoExtra = num(recibo.monto_horas_extra) ||
    montoHorasExtra({ salarioDiario: sd, horas: num(recibo.horas_extra) })
  const primaVacacional = num(recibo.prima_vacacional)
  const aguinaldo = num(recibo.aguinaldo)
  const bonos = num(recibo.bonos)
  const otrasPercepciones = num(recibo.otras_percepciones)

  const totalPercepciones = round2(
    sueldo + montoExtra + primaVacacional + aguinaldo + bonos + otrasPercepciones
  )

  const descuentoFaltas = round2(sd * (num(recibo.dias_falta) + num(recibo.dias_incapacidad)))

  // Exenciones del art. 93 LISR que se aplican solas: aguinaldo hasta 30 UMA y prima
  // vacacional hasta 15 UMA. Ademas, los conceptos del empleado marcados como no
  // gravables (despensa, transporte...) ya vienen sumados en percepciones_exentas.
  const aguinaldoExento = Math.min(aguinaldo, 30 * uma)
  const primaExenta = Math.min(primaVacacional, 15 * uma)
  const exentas = num(recibo.percepciones_exentas)
  const baseGravable = Math.max(
    0,
    round2(totalPercepciones - aguinaldoExento - primaExenta - exentas - descuentoFaltas)
  )

  const impuesto = calcularIsr({
    baseGravable,
    diasPeriodo: dias || 1,
    tarifa,
    subsidioMensual: num(cfg.subsidio_mensual),
    subsidioTope: num(cfg.subsidio_tope)
  })

  const imss = cuotaObreroImss({
    sbc: num(empleado.salario_diario_integrado) || sd,
    dias,
    uma
  }).total

  const infonavit = num(recibo.infonavit)
  const fonacot = num(recibo.fonacot)
  const prestamos = num(recibo.prestamos)
  const otrasDeducciones = num(recibo.otras_deducciones)

  const totalDeducciones = round2(
    impuesto.retencion + imss + infonavit + fonacot + prestamos + descuentoFaltas + otrasDeducciones
  )

  return {
    ...recibo,
    salario_diario: sd,
    sueldo,
    monto_horas_extra: round2(montoExtra),
    total_percepciones: totalPercepciones,
    percepciones_exentas: round2(exentas),
    isr: impuesto.isr,
    subsidio: impuesto.subsidio,
    imss,
    descuento_faltas: descuentoFaltas,
    total_deducciones: totalDeducciones,
    neto: round2(totalPercepciones - totalDeducciones)
  }
}

function guardarRecibo(db, recibo) {
  db.prepare(
    `INSERT INTO nomina_recibos (
        periodo_id, empleado_id, dias_trabajados, dias_falta, dias_incapacidad, dias_vacaciones,
        salario_diario, sueldo, horas_extra, monto_horas_extra, prima_vacacional, aguinaldo,
        bonos, otras_percepciones, total_percepciones, percepciones_exentas, isr, subsidio,
        imss, infonavit, fonacot, prestamos, descuento_faltas, otras_deducciones,
        total_deducciones, neto, notas)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (periodo_id, empleado_id) DO UPDATE SET
        dias_trabajados = excluded.dias_trabajados,
        dias_falta = excluded.dias_falta,
        dias_incapacidad = excluded.dias_incapacidad,
        dias_vacaciones = excluded.dias_vacaciones,
        salario_diario = excluded.salario_diario,
        sueldo = excluded.sueldo,
        horas_extra = excluded.horas_extra,
        monto_horas_extra = excluded.monto_horas_extra,
        prima_vacacional = excluded.prima_vacacional,
        aguinaldo = excluded.aguinaldo,
        bonos = excluded.bonos,
        otras_percepciones = excluded.otras_percepciones,
        total_percepciones = excluded.total_percepciones,
        percepciones_exentas = excluded.percepciones_exentas,
        isr = excluded.isr,
        subsidio = excluded.subsidio,
        imss = excluded.imss,
        infonavit = excluded.infonavit,
        fonacot = excluded.fonacot,
        prestamos = excluded.prestamos,
        descuento_faltas = excluded.descuento_faltas,
        otras_deducciones = excluded.otras_deducciones,
        total_deducciones = excluded.total_deducciones,
        neto = excluded.neto,
        notas = excluded.notas`
  ).run(
    recibo.periodo_id, recibo.empleado_id, num(recibo.dias_trabajados), num(recibo.dias_falta),
    num(recibo.dias_incapacidad), num(recibo.dias_vacaciones), num(recibo.salario_diario),
    num(recibo.sueldo), num(recibo.horas_extra), num(recibo.monto_horas_extra),
    num(recibo.prima_vacacional), num(recibo.aguinaldo), num(recibo.bonos),
    num(recibo.otras_percepciones), num(recibo.total_percepciones),
    num(recibo.percepciones_exentas), num(recibo.isr), num(recibo.subsidio), num(recibo.imss),
    num(recibo.infonavit), num(recibo.fonacot), num(recibo.prestamos),
    num(recibo.descuento_faltas), num(recibo.otras_deducciones), num(recibo.total_deducciones),
    num(recibo.neto), oNulo(recibo.notas)
  )
}

function actualizarTotalesPeriodo(db, periodo_id) {
  const t = db.prepare(
    `SELECT COUNT(*) AS n,
            COALESCE(SUM(total_percepciones), 0) AS p,
            COALESCE(SUM(total_deducciones), 0) AS d,
            COALESCE(SUM(neto), 0) AS neto
     FROM nomina_recibos WHERE periodo_id = ?`
  ).get(periodo_id)
  db.prepare(
    `UPDATE nomina_periodos
     SET num_empleados = ?, total_percepciones = ?, total_deducciones = ?, total_neto = ?
     WHERE id = ?`
  ).run(t.n, round2(t.p), round2(t.d), round2(t.neto), periodo_id)
}

export function register(ipcMain, getDb) {
  ipcMain.handle('nomina:periodos', () => {
    return getDb().prepare(
      `SELECT p.*, u.nombre AS usuario
       FROM nomina_periodos p
       LEFT JOIN usuarios u ON u.id = p.usuario_id
       ORDER BY p.fecha_inicio DESC`
    ).all()
  })

  ipcMain.handle('nomina:crearPeriodo', (event, data) => {
    const db = getDb()
    if (!limpiar(data.nombre)) return { ok: false, mensaje: 'Escribe el nombre del periodo' }
    if (!data.fecha_inicio || !data.fecha_fin) return { ok: false, mensaje: 'Captura las fechas del periodo' }
    if (data.fecha_fin < data.fecha_inicio) return { ok: false, mensaje: 'La fecha de fin no puede ser anterior al inicio' }

    const traslape = db.prepare(
      'SELECT * FROM nomina_periodos WHERE fecha_inicio <= ? AND fecha_fin >= ?'
    ).get(data.fecha_fin, data.fecha_inicio)
    if (traslape) return { ok: false, mensaje: `El periodo se empalma con "${traslape.nombre}"` }

    const tipo = TIPOS[data.tipo] ? data.tipo : 'quincenal'
    const dias = num(data.dias) || TIPOS[tipo]

    const info = db.prepare(
      `INSERT INTO nomina_periodos (nombre, tipo, fecha_inicio, fecha_fin, fecha_pago, dias, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      limpiar(data.nombre), tipo, data.fecha_inicio, data.fecha_fin,
      oNulo(data.fecha_pago) || data.fecha_fin, dias, data.usuario_id || null
    )
    return { ok: true, id: Number(info.lastInsertRowid) }
  })

  // Arma los recibos del periodo tomando la plantilla activa y las incidencias ya
  // capturadas. Se puede volver a ejecutar: los importes manuales se conservan.
  ipcMain.handle('nomina:generar', (event, { periodo_id, conservarManuales = true }) => {
    const db = getDb()
    const periodo = db.prepare('SELECT * FROM nomina_periodos WHERE id = ?').get(periodo_id)
    if (!periodo) return { ok: false, mensaje: 'Periodo no encontrado' }
    if (periodo.estatus === 'cerrado') return { ok: false, mensaje: 'El periodo ya está cerrado' }

    const ctx = contexto(db)
    const empleados = db.prepare(
      `SELECT * FROM empleados
       WHERE estatus = 'activo' AND fecha_ingreso <= ?
       ORDER BY apellido_paterno, nombre`
    ).all(periodo.fecha_fin)

    const previos = new Map(
      db.prepare('SELECT * FROM nomina_recibos WHERE periodo_id = ?').all(periodo_id).map((r) => [r.empleado_id, r])
    )

    // Cuanto de cada renglon venia de conceptos en la corrida anterior. Se necesita para
    // separar la parte capturada a mano de la automatica: sin esto, un concepto que vence
    // o se desactiva dejaria su importe pegado en el recibo.
    const conceptoPrevio = new Map()
    for (const fila of db.prepare(
      `SELECT r.empleado_id, c.clave, SUM(a.importe) AS total
       FROM concepto_aplicaciones a
       JOIN nomina_recibos r ON r.id = a.recibo_id
       JOIN conceptos_empleado c ON c.id = a.concepto_id
       WHERE a.periodo_id = ?
       GROUP BY r.empleado_id, c.clave`
    ).all(periodo_id)) {
      const campo = DESTINO[fila.clave]
      if (!campo) continue
      const porCampo = conceptoPrevio.get(fila.empleado_id) || {}
      porCampo[campo] = round2((porCampo[campo] || 0) + num(fila.total))
      conceptoPrevio.set(fila.empleado_id, porCampo)
    }

    db.exec('BEGIN')
    try {
      // Se rehacen desde cero: si no, regenerar el periodo amortizaria dos veces.
      db.prepare('DELETE FROM concepto_aplicaciones WHERE periodo_id = ?').run(periodo_id)

      for (const empleado of empleados) {
        const incidencias = incidenciasDelPeriodo(db, empleado, periodo)
        const previo = conservarManuales ? previos.get(empleado.id) : null

        const diasPeriodo = num(periodo.dias)
        const primaVacacional = incidencias.dias_prima > 0
          ? round2(empleado.salario_diario * incidencias.dias_prima * num(ctx.cfg.prima_vacacional) / 100)
          : num(previo?.prima_vacacional)

        const sueldoPeriodo = round2(num(empleado.salario_diario) * diasPeriodo)
        const conceptos = conceptosDelPeriodo(db, empleado, periodo, sueldoPeriodo)

        const base = {
          periodo_id,
          empleado_id: empleado.id,
          dias_trabajados: diasPeriodo,
          dias_falta: incidencias.dias_falta,
          dias_incapacidad: incidencias.dias_incapacidad,
          dias_vacaciones: incidencias.dias_vacaciones,
          salario_diario: empleado.salario_diario,
          horas_extra: incidencias.horas_extra,
          monto_horas_extra: 0,
          prima_vacacional: primaVacacional,
          aguinaldo: num(previo?.aguinaldo),
          percepciones_exentas: conceptos.exentas,
          notas: previo?.notas || null
        }

        // Cada renglon se rearma como "lo capturado a mano" + "lo que aportan los
        // conceptos vigentes ahora". Lo manual sobrevive a regenerar; lo automatico se
        // recalcula siempre, asi que un concepto vencido desaparece del recibo.
        const previoConcepto = conceptoPrevio.get(empleado.id) || {}
        for (const campo of CAMPOS_CONCEPTO) {
          const manual = Math.max(0, round2(num(previo?.[campo]) - num(previoConcepto[campo])))
          base[campo] = round2(manual + num(conceptos.campos[campo]))
        }

        guardarRecibo(db, recalcular(base, empleado, ctx))

        if (conceptos.aplicaciones.length) {
          const recibo = db.prepare(
            'SELECT id FROM nomina_recibos WHERE periodo_id = ? AND empleado_id = ?'
          ).get(periodo_id, empleado.id)
          const stmt = db.prepare(
            'INSERT INTO concepto_aplicaciones (concepto_id, periodo_id, recibo_id, importe) VALUES (?, ?, ?, ?)'
          )
          for (const a of conceptos.aplicaciones) stmt.run(a.concepto_id, periodo_id, recibo.id, a.importe)
        }
      }

      // Un empleado dado de baja despues de generar deja de aparecer en el periodo.
      const ids = empleados.map((e) => e.id)
      for (const [empleadoId] of previos) {
        if (!ids.includes(empleadoId)) {
          db.prepare('DELETE FROM nomina_recibos WHERE periodo_id = ? AND empleado_id = ?')
            .run(periodo_id, empleadoId)
        }
      }

      actualizarTotalesPeriodo(db, periodo_id)
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      return { ok: false, mensaje: `No se pudo generar la nómina: ${e.message}` }
    }

    return { ok: true, empleados: empleados.length }
  })

  ipcMain.handle('nomina:recibos', (event, periodo_id) => {
    return getDb().prepare(
      `SELECT r.*, (e.nombre || ' ' || e.apellido_paterno || ' ' || COALESCE(e.apellido_materno, '')) AS empleado,
              e.numero_empleado, e.rfc, e.curp, e.nss, e.salario_diario_integrado,
              d.nombre AS departamento, p.nombre AS puesto
       FROM nomina_recibos r
       JOIN empleados e ON e.id = r.empleado_id
       LEFT JOIN departamentos d ON d.id = e.departamento_id
       LEFT JOIN puestos p ON p.id = e.puesto_id
       WHERE r.periodo_id = ?
       ORDER BY e.apellido_paterno, e.nombre`
    ).all(periodo_id)
  })

  ipcMain.handle('nomina:actualizarRecibo', (event, { id, data }) => {
    const db = getDb()
    const recibo = db.prepare('SELECT * FROM nomina_recibos WHERE id = ?').get(id)
    if (!recibo) return { ok: false, mensaje: 'Recibo no encontrado' }

    const periodo = db.prepare('SELECT * FROM nomina_periodos WHERE id = ?').get(recibo.periodo_id)
    if (periodo.estatus === 'cerrado') return { ok: false, mensaje: 'El periodo está cerrado' }

    const empleado = db.prepare('SELECT * FROM empleados WHERE id = ?').get(recibo.empleado_id)
    const ctx = contexto(db)

    const actualizado = recalcular({ ...recibo, ...data, id }, empleado, ctx)
    guardarRecibo(db, actualizado)
    actualizarTotalesPeriodo(db, recibo.periodo_id)
    return { ok: true, recibo: db.prepare('SELECT * FROM nomina_recibos WHERE id = ?').get(id) }
  })

  // Sugerencia de aguinaldo proporcional al 31 de diciembre del ano del periodo.
  ipcMain.handle('nomina:calcularAguinaldo', (event, periodo_id) => {
    const db = getDb()
    const periodo = db.prepare('SELECT * FROM nomina_periodos WHERE id = ?').get(periodo_id)
    if (!periodo) return { ok: false, mensaje: 'Periodo no encontrado' }

    const cfg = db.prepare('SELECT * FROM configuracion WHERE id = 1').get()
    const anio = Number(String(periodo.fecha_fin).slice(0, 4))
    const recibos = db.prepare(
      `SELECT r.*, e.fecha_ingreso, e.salario_diario,
              (e.nombre || ' ' || e.apellido_paterno) AS empleado
       FROM nomina_recibos r JOIN empleados e ON e.id = r.empleado_id
       WHERE r.periodo_id = ?`
    ).all(periodo_id)

    return {
      ok: true,
      sugerencias: recibos.map((r) => {
        const calculo = aguinaldoProporcional({
          salarioDiario: r.salario_diario,
          diasAguinaldo: cfg.dias_aguinaldo,
          fechaIngreso: r.fecha_ingreso,
          anio,
          alDia: `${anio}-12-31`
        })
        return { recibo_id: r.id, empleado: r.empleado, ...calculo }
      })
    }
  })

  ipcMain.handle('nomina:aplicarAguinaldo', (event, { periodo_id, sugerencias }) => {
    const db = getDb()
    const periodo = db.prepare('SELECT * FROM nomina_periodos WHERE id = ?').get(periodo_id)
    if (!periodo) return { ok: false, mensaje: 'Periodo no encontrado' }
    if (periodo.estatus === 'cerrado') return { ok: false, mensaje: 'El periodo está cerrado' }

    const ctx = contexto(db)
    db.exec('BEGIN')
    try {
      for (const s of sugerencias || []) {
        const recibo = db.prepare('SELECT * FROM nomina_recibos WHERE id = ?').get(s.recibo_id)
        if (!recibo) continue
        const empleado = db.prepare('SELECT * FROM empleados WHERE id = ?').get(recibo.empleado_id)
        guardarRecibo(db, recalcular({ ...recibo, aguinaldo: num(s.monto) }, empleado, ctx))
      }
      actualizarTotalesPeriodo(db, periodo_id)
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      return { ok: false, mensaje: 'No se pudo aplicar el aguinaldo' }
    }
    return { ok: true }
  })

  ipcMain.handle('nomina:cerrarPeriodo', (event, periodo_id) => {
    const db = getDb()
    const periodo = db.prepare('SELECT * FROM nomina_periodos WHERE id = ?').get(periodo_id)
    if (!periodo) return { ok: false, mensaje: 'Periodo no encontrado' }
    const n = db.prepare('SELECT COUNT(*) AS n FROM nomina_recibos WHERE periodo_id = ?').get(periodo_id).n
    if (n === 0) return { ok: false, mensaje: 'Genera la nómina antes de cerrar el periodo' }

    db.prepare("UPDATE nomina_periodos SET estatus = 'cerrado' WHERE id = ?").run(periodo_id)
    return { ok: true }
  })

  ipcMain.handle('nomina:reabrirPeriodo', (event, periodo_id) => {
    getDb().prepare("UPDATE nomina_periodos SET estatus = 'abierto' WHERE id = ?").run(periodo_id)
    return { ok: true }
  })

  ipcMain.handle('nomina:eliminarPeriodo', (event, periodo_id) => {
    const db = getDb()
    const periodo = db.prepare('SELECT * FROM nomina_periodos WHERE id = ?').get(periodo_id)
    if (!periodo) return { ok: false, mensaje: 'Periodo no encontrado' }
    if (periodo.estatus === 'cerrado') {
      return { ok: false, mensaje: 'Un periodo cerrado no se puede eliminar; primero reábrelo' }
    }
    db.exec('BEGIN')
    try {
      db.prepare('DELETE FROM nomina_recibos WHERE periodo_id = ?').run(periodo_id)
      db.prepare('DELETE FROM nomina_periodos WHERE id = ?').run(periodo_id)
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      return { ok: false, mensaje: 'No se pudo eliminar el periodo' }
    }
    return { ok: true }
  })

  ipcMain.handle('nomina:imprimirRecibo', async (event, id) => {
    const db = getDb()
    const recibo = db.prepare(
      `SELECT r.*, (e.nombre || ' ' || e.apellido_paterno || ' ' || COALESCE(e.apellido_materno, '')) AS empleado,
              e.numero_empleado, e.rfc, e.curp, e.nss, e.fecha_ingreso, e.salario_diario_integrado,
              d.nombre AS departamento, p.nombre AS puesto
       FROM nomina_recibos r
       JOIN empleados e ON e.id = r.empleado_id
       LEFT JOIN departamentos d ON d.id = e.departamento_id
       LEFT JOIN puestos p ON p.id = e.puesto_id
       WHERE r.id = ?`
    ).get(id)
    if (!recibo) return { ok: false, mensaje: 'Recibo no encontrado' }

    const periodo = db.prepare('SELECT * FROM nomina_periodos WHERE id = ?').get(recibo.periodo_id)
    const cfg = db.prepare('SELECT * FROM configuracion WHERE id = 1').get()
    const conceptos = db.prepare(
      `SELECT a.importe, c.clave, c.tipo, c.descripcion, c.numero_credito
       FROM concepto_aplicaciones a
       JOIN conceptos_empleado c ON c.id = a.concepto_id
       WHERE a.recibo_id = ? ORDER BY c.tipo, c.clave`
    ).all(recibo.id)

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Guardar recibo de nómina',
      defaultPath: `recibo-${recibo.numero_empleado || recibo.empleado_id}-${periodo.fecha_fin}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (canceled || !filePath) return { ok: false, canceled: true }

    const ventana = new BrowserWindow({ show: false, webPreferences: { offscreen: true } })
    try {
      const html = plantillaRecibo({ recibo, periodo, cfg, conceptos })
      await ventana.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
      const pdf = await ventana.webContents.printToPDF({ pageSize: 'Letter', printBackground: true })
      fs.writeFileSync(filePath, pdf)
      return { ok: true, ruta: filePath }
    } catch (e) {
      return { ok: false, mensaje: `No se pudo generar el PDF: ${e.message}` }
    } finally {
      ventana.destroy()
    }
  })
}

function dinero(n) {
  return Number(n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
}

function plantillaRecibo({ recibo, periodo, cfg, conceptos = [] }) {
  // Cada concepto del empleado va con su propio nombre y, si es un credito, su numero.
  // Lo que se haya capturado a mano en ese mismo renglon se muestra como remanente.
  const detalle = (campo, etiquetaGenerica) => {
    const propios = conceptos.filter((c) => (DESTINO[c.clave] || '') === campo)
    const sumaPropios = propios.reduce((t, c) => t + num(c.importe), 0)
    const manual = round2(num(recibo[campo]) - sumaPropios)

    const filas = propios.map((c) => [
      `${ETIQUETA_CONCEPTO[c.clave] || c.clave}${c.numero_credito ? ` (${c.numero_credito})` : ''}` +
        `${c.descripcion ? ` — ${c.descripcion}` : ''}`,
      c.importe
    ])
    if (manual > 0.005) filas.push([etiquetaGenerica, manual])
    return filas
  }

  const percepciones = [
    ['Sueldo', recibo.sueldo],
    ['Horas extra', recibo.monto_horas_extra],
    ['Prima vacacional', recibo.prima_vacacional],
    ['Aguinaldo', recibo.aguinaldo],
    ...detalle('bonos', 'Bonos'),
    ...detalle('otras_percepciones', 'Otras percepciones')
  ].filter(([, v]) => num(v) > 0)

  const deducciones = [
    ['ISR retenido', round2(num(recibo.isr) - num(recibo.subsidio))],
    ['IMSS', recibo.imss],
    ...detalle('infonavit', 'INFONAVIT'),
    ...detalle('fonacot', 'FONACOT'),
    ...detalle('prestamos', 'Préstamos'),
    ['Faltas e incapacidades', recibo.descuento_faltas],
    ...detalle('otras_deducciones', 'Otras deducciones')
  ].filter(([, v]) => num(v) > 0)

  const filas = (lista) => lista.map(([k, v]) => `<tr><td>${k}</td><td class="r">${dinero(v)}</td></tr>`).join('')

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { font-family: 'Segoe UI', system-ui, sans-serif; color: #2D3436; padding: 32px; font-size: 12px; }
    h1 { font-size: 18px; margin: 0 0 2px; }
    .sub { color: #636E72; font-size: 11px; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #6C5CE7; padding-bottom: 12px; margin-bottom: 18px; }
    .logo { height: 54px; object-fit: contain; }
    .datos { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin-bottom: 18px; }
    .datos div { border-bottom: 1px solid #eee; padding: 4px 0; }
    .datos span { color: #636E72; }
    .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 10px; text-transform: uppercase; color: #6C5CE7; border-bottom: 1.5px solid #6C5CE7; padding: 6px 0; }
    td { padding: 5px 0; border-bottom: 1px solid #eee; }
    td.r, th.r { text-align: right; }
    .total { font-weight: 700; border-top: 1.5px solid #2D3436; }
    .neto { margin-top: 24px; background: #F5F3FF; border-radius: 10px; padding: 14px 18px; display: flex; justify-content: space-between; font-size: 15px; font-weight: 700; }
    .firma { margin-top: 64px; text-align: center; font-size: 11px; color: #636E72; }
    .firma div { border-top: 1px solid #2D3436; width: 240px; margin: 0 auto 6px; }
  </style></head><body>
    <div class="head">
      <div>
        <h1>${cfg.nombre_empresa || ''}</h1>
        <div class="sub">${cfg.razon_social || ''}${cfg.rfc ? ` · RFC ${cfg.rfc}` : ''}</div>
        <div class="sub">${cfg.registro_patronal ? `Registro patronal ${cfg.registro_patronal}` : ''}</div>
      </div>
      ${cfg.logo ? `<img class="logo" src="${cfg.logo}" />` : ''}
    </div>

    <h1 style="font-size:14px">Recibo de nómina</h1>
    <div class="sub" style="margin-bottom:14px">${periodo.nombre} · del ${periodo.fecha_inicio} al ${periodo.fecha_fin}</div>

    <div class="datos">
      <div><span>Empleado:</span> <strong>${recibo.empleado}</strong></div>
      <div><span>No. empleado:</span> ${recibo.numero_empleado || '—'}</div>
      <div><span>Puesto:</span> ${recibo.puesto || '—'}</div>
      <div><span>Departamento:</span> ${recibo.departamento || '—'}</div>
      <div><span>RFC:</span> ${recibo.rfc || '—'}</div>
      <div><span>CURP:</span> ${recibo.curp || '—'}</div>
      <div><span>NSS:</span> ${recibo.nss || '—'}</div>
      <div><span>Fecha de ingreso:</span> ${recibo.fecha_ingreso}</div>
      <div><span>Salario diario:</span> ${dinero(recibo.salario_diario)}</div>
      <div><span>Salario diario integrado:</span> ${dinero(recibo.salario_diario_integrado)}</div>
      <div><span>Días pagados:</span> ${recibo.dias_trabajados}</div>
      <div><span>Faltas / incapacidad:</span> ${recibo.dias_falta} / ${recibo.dias_incapacidad}</div>
    </div>

    <div class="cols">
      <table>
        <thead><tr><th>Percepciones</th><th class="r">Importe</th></tr></thead>
        <tbody>${filas(percepciones)}
          <tr class="total"><td>Total percepciones</td><td class="r">${dinero(recibo.total_percepciones)}</td></tr>
        </tbody>
      </table>
      <table>
        <thead><tr><th>Deducciones</th><th class="r">Importe</th></tr></thead>
        <tbody>${filas(deducciones)}
          <tr class="total"><td>Total deducciones</td><td class="r">${dinero(recibo.total_deducciones)}</td></tr>
        </tbody>
      </table>
    </div>

    <div class="neto"><span>Neto a pagar</span><span>${dinero(recibo.neto)}</span></div>

    <div class="firma">
      <div></div>
      Recibí de conformidad — ${recibo.empleado}
    </div>
    <div class="sub" style="margin-top:28px; text-align:center">Generado el ${hoy()}</div>
  </body></html>`
}
