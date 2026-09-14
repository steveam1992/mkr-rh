import { oNulo, num, hoy, round2, fecha, aIso, horasEntre, minutosRetardo, primerDiaDelMes, ultimoDiaDelMes } from '../utils'

const ESTATUS = ['asistencia', 'retardo', 'falta', 'permiso', 'vacaciones', 'incapacidad', 'descanso', 'festivo']
const JORNADA_HORAS = 8

function descansosDe(empleado) {
  if (!empleado?.dias_descanso) return [0]
  return String(empleado.dias_descanso)
    .split(',')
    .map((d) => parseInt(d, 10))
    .filter((d) => Number.isFinite(d) && d >= 0 && d <= 6)
}

// La entrada y la salida capturadas se convierten en horas trabajadas, minutos de
// retardo (contra el horario del empleado y la tolerancia de la empresa) y horas extra.
function calcular(db, empleado, data) {
  const cfg = db.prepare('SELECT tolerancia_retardo FROM configuracion WHERE id = 1').get()
  const tolerancia = num(cfg?.tolerancia_retardo, 10)

  const horas = horasEntre(data.hora_entrada, data.hora_salida)
  const retardoBruto = minutosRetardo(empleado.hora_entrada, data.hora_entrada)
  const retardo = retardoBruto > tolerancia ? retardoBruto : 0
  const extra = horas > JORNADA_HORAS ? round2(horas - JORNADA_HORAS) : 0

  let estatus = data.estatus
  if (!estatus || estatus === 'auto') {
    if (!data.hora_entrada) estatus = 'falta'
    else estatus = retardo > 0 ? 'retardo' : 'asistencia'
  } else if (estatus === 'asistencia' && retardo > 0) {
    // Una asistencia que entro fuera de la tolerancia es un retardo, aunque quien
    // captura haya dejado el estatus sugerido: si no, no aparece en el concentrado.
    estatus = 'retardo'
  }

  return { horas, retardo, extra, estatus: ESTATUS.includes(estatus) ? estatus : 'asistencia' }
}

export function register(ipcMain, getDb) {
  // Plantilla del dia: todos los empleados activos con su registro si ya existe, mas el
  // motivo por el que alguien no deberia aparecer como falta (vacaciones, incapacidad...).
  ipcMain.handle('asistencia:dia', (event, { fecha: dia, departamento_id } = {}) => {
    const db = getDb()
    const f = dia || hoy()
    const params = []
    let where = "WHERE e.estatus = 'activo'"
    if (departamento_id) {
      where += ' AND e.departamento_id = ?'
      params.push(departamento_id)
    }

    const empleados = db.prepare(
      `SELECT e.*, d.nombre AS departamento, p.nombre AS puesto
       FROM empleados e
       LEFT JOIN departamentos d ON d.id = e.departamento_id
       LEFT JOIN puestos p ON p.id = e.puesto_id
       ${where} ORDER BY e.apellido_paterno, e.nombre`
    ).all(...params)

    const registros = new Map(
      db.prepare('SELECT * FROM asistencia WHERE fecha = ?').all(f).map((r) => [r.empleado_id, r])
    )
    const enVacaciones = new Set(
      db.prepare(
        `SELECT empleado_id FROM vacaciones
         WHERE estatus IN ('aprobada', 'disfrutada') AND fecha_inicio <= ? AND fecha_fin >= ?`
      ).all(f, f).map((r) => r.empleado_id)
    )
    const enIncapacidad = new Set(
      db.prepare('SELECT empleado_id FROM incapacidades WHERE fecha_inicio <= ? AND fecha_fin >= ?')
        .all(f, f).map((r) => r.empleado_id)
    )
    const conPermiso = new Set(
      db.prepare(
        `SELECT empleado_id FROM permisos
         WHERE estatus = 'aprobado' AND tipo NOT IN ('falta', 'retardo')
           AND fecha_inicio <= ? AND fecha_fin >= ?`
      ).all(f, f).map((r) => r.empleado_id)
    )
    const esFestivo = !!db.prepare('SELECT id FROM dias_festivos WHERE fecha = ?').get(f)
    const diaSemana = fecha(f)?.getDay()

    return empleados.map((e) => {
      const registro = registros.get(e.id) || null
      let sugerido = 'asistencia'
      if (enIncapacidad.has(e.id)) sugerido = 'incapacidad'
      else if (enVacaciones.has(e.id)) sugerido = 'vacaciones'
      else if (conPermiso.has(e.id)) sugerido = 'permiso'
      else if (esFestivo) sugerido = 'festivo'
      else if (descansosDe(e).includes(diaSemana)) sugerido = 'descanso'

      return {
        empleado_id: e.id,
        nombre_completo: [e.nombre, e.apellido_paterno, e.apellido_materno].filter(Boolean).join(' '),
        numero_empleado: e.numero_empleado,
        departamento: e.departamento,
        puesto: e.puesto,
        hora_entrada_esperada: e.hora_entrada,
        hora_salida_esperada: e.hora_salida,
        sugerido,
        bloqueado: ['incapacidad', 'vacaciones', 'permiso'].includes(sugerido),
        registro
      }
    })
  })

  ipcMain.handle('asistencia:guardar', (event, data) => {
    const db = getDb()
    const empleado = db.prepare('SELECT * FROM empleados WHERE id = ?').get(data.empleado_id)
    if (!empleado) return { ok: false, mensaje: 'Empleado no encontrado' }
    if (!data.fecha) return { ok: false, mensaje: 'Selecciona la fecha' }
    if (data.fecha > hoy()) return { ok: false, mensaje: 'No se puede registrar asistencia de un día futuro' }

    const { horas, retardo, extra, estatus } = calcular(db, empleado, data)
    db.prepare(
      `INSERT INTO asistencia (empleado_id, fecha, hora_entrada, hora_salida, horas,
                               minutos_retardo, horas_extra, estatus, nota, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (empleado_id, fecha) DO UPDATE SET
         hora_entrada = excluded.hora_entrada,
         hora_salida = excluded.hora_salida,
         horas = excluded.horas,
         minutos_retardo = excluded.minutos_retardo,
         horas_extra = excluded.horas_extra,
         estatus = excluded.estatus,
         nota = excluded.nota,
         usuario_id = excluded.usuario_id`
    ).run(
      data.empleado_id, data.fecha, oNulo(data.hora_entrada), oNulo(data.hora_salida),
      horas, retardo, num(data.horas_extra) || extra, estatus, oNulo(data.nota),
      data.usuario_id || null
    )
    return { ok: true }
  })

  ipcMain.handle('asistencia:guardarLote', (event, { fecha: dia, registros, usuario_id }) => {
    const db = getDb()
    if (!dia) return { ok: false, mensaje: 'Selecciona la fecha' }
    if (dia > hoy()) return { ok: false, mensaje: 'No se puede registrar asistencia de un día futuro' }

    let guardados = 0
    db.exec('BEGIN')
    try {
      for (const r of registros || []) {
        const empleado = db.prepare('SELECT * FROM empleados WHERE id = ?').get(r.empleado_id)
        if (!empleado) continue
        const { horas, retardo, extra, estatus } = calcular(db, empleado, r)
        db.prepare(
          `INSERT INTO asistencia (empleado_id, fecha, hora_entrada, hora_salida, horas,
                                   minutos_retardo, horas_extra, estatus, nota, usuario_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (empleado_id, fecha) DO UPDATE SET
             hora_entrada = excluded.hora_entrada,
             hora_salida = excluded.hora_salida,
             horas = excluded.horas,
             minutos_retardo = excluded.minutos_retardo,
             horas_extra = excluded.horas_extra,
             estatus = excluded.estatus,
             nota = excluded.nota,
             usuario_id = excluded.usuario_id`
        ).run(
          r.empleado_id, dia, oNulo(r.hora_entrada), oNulo(r.hora_salida), horas, retardo,
          num(r.horas_extra) || extra, estatus, oNulo(r.nota), usuario_id || null
        )
        guardados += 1
      }
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      return { ok: false, mensaje: `No se pudo guardar la asistencia: ${e.message}` }
    }
    return { ok: true, guardados }
  })

  ipcMain.handle('asistencia:listar', (event, filtros = {}) => {
    const db = getDb()
    const condiciones = []
    const params = []
    if (filtros.empleado_id) {
      condiciones.push('a.empleado_id = ?')
      params.push(filtros.empleado_id)
    }
    if (filtros.desde) {
      condiciones.push('a.fecha >= ?')
      params.push(filtros.desde)
    }
    if (filtros.hasta) {
      condiciones.push('a.fecha <= ?')
      params.push(filtros.hasta)
    }
    if (filtros.estatus && filtros.estatus !== 'todos') {
      condiciones.push('a.estatus = ?')
      params.push(filtros.estatus)
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''
    return db.prepare(
      `SELECT a.*, (e.nombre || ' ' || e.apellido_paterno) AS empleado, d.nombre AS departamento
       FROM asistencia a
       JOIN empleados e ON e.id = a.empleado_id
       LEFT JOIN departamentos d ON d.id = e.departamento_id
       ${where} ORDER BY a.fecha DESC, e.apellido_paterno`
    ).all(...params)
  })

  ipcMain.handle('asistencia:resumen', (event, { desde, hasta, departamento_id } = {}) => {
    const db = getDb()
    const d = desde || primerDiaDelMes()
    const h = hasta || ultimoDiaDelMes()
    const params = [d, h]
    let filtroDepto = ''
    if (departamento_id) {
      filtroDepto = 'AND e.departamento_id = ?'
      params.push(departamento_id)
    }

    return db.prepare(
      `SELECT e.id AS empleado_id, e.numero_empleado,
              (e.nombre || ' ' || e.apellido_paterno || ' ' || COALESCE(e.apellido_materno, '')) AS empleado,
              d.nombre AS departamento,
              SUM(CASE WHEN a.estatus = 'asistencia' THEN 1 ELSE 0 END) AS asistencias,
              SUM(CASE WHEN a.estatus = 'retardo' THEN 1 ELSE 0 END) AS retardos,
              SUM(CASE WHEN a.estatus = 'falta' THEN 1 ELSE 0 END) AS faltas,
              SUM(CASE WHEN a.estatus = 'vacaciones' THEN 1 ELSE 0 END) AS vacaciones,
              SUM(CASE WHEN a.estatus = 'incapacidad' THEN 1 ELSE 0 END) AS incapacidades,
              SUM(CASE WHEN a.estatus = 'permiso' THEN 1 ELSE 0 END) AS permisos,
              COALESCE(SUM(a.horas), 0) AS horas,
              COALESCE(SUM(a.horas_extra), 0) AS horas_extra,
              COALESCE(SUM(a.minutos_retardo), 0) AS minutos_retardo
       FROM empleados e
       LEFT JOIN asistencia a ON a.empleado_id = e.id AND a.fecha BETWEEN ? AND ?
       LEFT JOIN departamentos d ON d.id = e.departamento_id
       WHERE e.estatus = 'activo' ${filtroDepto}
       GROUP BY e.id ORDER BY faltas DESC, retardos DESC, empleado`
    ).all(...params)
  })

  // Calendario mensual de ausencias: una fila por empleado y una celda por dia,
  // juntando asistencia, vacaciones, incapacidades, permisos, descansos y festivos.
  ipcMain.handle('asistencia:calendario', (event, { anio, mes, departamento_id } = {}) => {
    const db = getDb()
    const y = anio || new Date().getFullYear()
    const m = mes || new Date().getMonth() + 1
    const inicio = `${y}-${String(m).padStart(2, '0')}-01`
    const fin = ultimoDiaDelMes(inicio)

    const params = []
    let where = "WHERE e.estatus = 'activo'"
    if (departamento_id) {
      where += ' AND e.departamento_id = ?'
      params.push(departamento_id)
    }
    const empleados = db.prepare(
      `SELECT e.id, e.nombre, e.apellido_paterno, e.apellido_materno, e.dias_descanso, d.nombre AS departamento
       FROM empleados e
       LEFT JOIN departamentos d ON d.id = e.departamento_id
       ${where} ORDER BY e.apellido_paterno, e.nombre`
    ).all(...params)

    const festivos = new Set(
      db.prepare('SELECT fecha FROM dias_festivos WHERE fecha BETWEEN ? AND ?').all(inicio, fin).map((f) => f.fecha)
    )
    const asistencias = db.prepare('SELECT * FROM asistencia WHERE fecha BETWEEN ? AND ?').all(inicio, fin)
    const vacaciones = db.prepare(
      `SELECT * FROM vacaciones WHERE estatus IN ('aprobada', 'disfrutada')
       AND fecha_inicio <= ? AND fecha_fin >= ?`
    ).all(fin, inicio)
    const incapacidades = db.prepare(
      'SELECT * FROM incapacidades WHERE fecha_inicio <= ? AND fecha_fin >= ?'
    ).all(fin, inicio)
    const permisos = db.prepare(
      `SELECT * FROM permisos WHERE estatus = 'aprobado' AND tipo NOT IN ('retardo')
       AND fecha_inicio <= ? AND fecha_fin >= ?`
    ).all(fin, inicio)

    const dias = []
    const cursor = fecha(inicio)
    const limite = fecha(fin)
    while (cursor <= limite) {
      dias.push({ fecha: aIso(cursor), dia: cursor.getDate(), diaSemana: cursor.getDay() })
      cursor.setDate(cursor.getDate() + 1)
    }

    const filas = empleados.map((e) => {
      const descansos = descansosDe(e)
      const celdas = {}

      for (const d of dias) {
        if (festivos.has(d.fecha)) celdas[d.fecha] = 'festivo'
        else if (descansos.includes(d.diaSemana)) celdas[d.fecha] = 'descanso'
      }
      // Cada fuente pisa a la anterior: lo mas especifico gana.
      for (const p of permisos.filter((x) => x.empleado_id === e.id)) marcar(celdas, dias, p.fecha_inicio, p.fecha_fin, p.tipo === 'falta' ? 'falta' : 'permiso')
      for (const v of vacaciones.filter((x) => x.empleado_id === e.id)) marcar(celdas, dias, v.fecha_inicio, v.fecha_fin, 'vacaciones')
      for (const i of incapacidades.filter((x) => x.empleado_id === e.id)) marcar(celdas, dias, i.fecha_inicio, i.fecha_fin, 'incapacidad')
      for (const a of asistencias.filter((x) => x.empleado_id === e.id)) celdas[a.fecha] = a.estatus

      return {
        empleado_id: e.id,
        nombre_completo: [e.nombre, e.apellido_paterno, e.apellido_materno].filter(Boolean).join(' '),
        departamento: e.departamento,
        celdas
      }
    })

    return { anio: y, mes: m, dias, filas }
  })

  ipcMain.handle('asistencia:eliminar', (event, id) => {
    getDb().prepare('DELETE FROM asistencia WHERE id = ?').run(id)
    return { ok: true }
  })
}

function marcar(celdas, dias, desde, hasta, valor) {
  for (const d of dias) {
    if (d.fecha >= desde && d.fecha <= hasta) celdas[d.fecha] = valor
  }
}
