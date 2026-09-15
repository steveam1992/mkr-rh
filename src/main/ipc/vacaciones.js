import { limpiar, oNulo, num, hoy, round2, fecha, aIso, diasEntre } from '../utils'
import { saldoVacaciones, vencimientoPeriodo } from '../lft'


function tablaVacaciones(db) {
  return db.prepare('SELECT * FROM vacaciones_tabla ORDER BY anio').all()
}

function diasDescanso(empleado) {
  if (!empleado?.dias_descanso) return [0]
  return String(empleado.dias_descanso)
    .split(',')
    .map((d) => parseInt(d, 10))
    .filter((d) => Number.isFinite(d) && d >= 0 && d <= 6)
}

// Dias de disfrute reales: se excluyen los descansos del empleado y los festivos.
// Se devuelve el desglose y no solo el total, porque cuando el numero no cuadra con lo
// que espera quien captura casi siempre es que el empleado tiene mal sus descansos.
function desgloseDias(db, empleado, inicio, fin) {
  const descansos = diasDescanso(empleado)
  const festivos = new Set(
    db.prepare('SELECT fecha FROM dias_festivos WHERE fecha BETWEEN ? AND ?').all(inicio, fin).map((f) => f.fecha)
  )
  let habiles = 0
  let enDescanso = 0
  let enFestivo = 0
  const cursor = fecha(inicio)
  const limite = fecha(fin)
  while (cursor && limite && cursor <= limite) {
    const iso = aIso(cursor)
    if (descansos.includes(cursor.getDay())) enDescanso += 1
    else if (festivos.has(iso)) enFestivo += 1
    else habiles += 1
    cursor.setDate(cursor.getDate() + 1)
  }
  return { habiles, enDescanso, enFestivo }
}

function diasHabiles(db, empleado, inicio, fin) {
  return desgloseDias(db, empleado, inicio, fin).habiles
}

function saldoDe(db, empleado, alDia = hoy()) {
  const tomados = db.prepare(
    `SELECT COALESCE(SUM(dias), 0) AS dias FROM vacaciones
     WHERE empleado_id = ? AND estatus IN ('aprobada', 'disfrutada')`
  ).get(empleado.id).dias
  const ajustes = db.prepare(
    'SELECT COALESCE(SUM(dias), 0) AS dias FROM vacaciones_ajustes WHERE empleado_id = ?'
  ).get(empleado.id).dias

  return saldoVacaciones({
    fechaIngreso: empleado.fecha_ingreso,
    tabla: tablaVacaciones(db),
    diasTomados: tomados,
    ajustes,
    alDia
  })
}

export function register(ipcMain, getDb) {
  ipcMain.handle('vacaciones:listar', (event, filtros = {}) => {
    const db = getDb()
    const condiciones = []
    const params = []

    if (filtros.empleado_id) {
      condiciones.push('v.empleado_id = ?')
      params.push(filtros.empleado_id)
    }
    if (filtros.estatus && filtros.estatus !== 'todos') {
      condiciones.push('v.estatus = ?')
      params.push(filtros.estatus)
    }
    if (filtros.desde) {
      condiciones.push('v.fecha_fin >= ?')
      params.push(filtros.desde)
    }
    if (filtros.hasta) {
      condiciones.push('v.fecha_inicio <= ?')
      params.push(filtros.hasta)
    }
    if (filtros.departamento_id) {
      condiciones.push('e.departamento_id = ?')
      params.push(filtros.departamento_id)
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''
    return db.prepare(
      `SELECT v.*, (e.nombre || ' ' || e.apellido_paterno || ' ' || COALESCE(e.apellido_materno, '')) AS empleado,
              e.numero_empleado, d.nombre AS departamento, u.nombre AS resuelto_por_nombre
       FROM vacaciones v
       JOIN empleados e ON e.id = v.empleado_id
       LEFT JOIN departamentos d ON d.id = e.departamento_id
       LEFT JOIN usuarios u ON u.id = v.resuelto_por
       ${where}
       ORDER BY v.fecha_inicio DESC`
    ).all(...params)
  })

  ipcMain.handle('vacaciones:saldos', (event, { departamento_id } = {}) => {
    const db = getDb()
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

    return empleados.map((e) => {
      const saldo = saldoDe(db, e)
      return {
        id: e.id,
        numero_empleado: e.numero_empleado,
        nombre_completo: [e.nombre, e.apellido_paterno, e.apellido_materno].filter(Boolean).join(' '),
        departamento: e.departamento,
        puesto: e.puesto,
        fecha_ingreso: e.fecha_ingreso,
        ...saldo,
        vence: vencimientoPeriodo(e.fecha_ingreso, Math.max(1, saldo.anios))
      }
    })
  })

  ipcMain.handle('vacaciones:saldo', (event, empleado_id) => {
    const db = getDb()
    const empleado = db.prepare('SELECT * FROM empleados WHERE id = ?').get(empleado_id)
    if (!empleado) return null
    return saldoDe(db, empleado)
  })

  ipcMain.handle('vacaciones:calcularDias', (event, { empleado_id, fecha_inicio, fecha_fin }) => {
    const db = getDb()
    const vacio = { dias: 0, naturales: 0, enDescanso: 0, enFestivo: 0 }
    if (!fecha_inicio || !fecha_fin || fecha_fin < fecha_inicio) return vacio
    const empleado = db.prepare('SELECT * FROM empleados WHERE id = ?').get(empleado_id)
    const desglose = desgloseDias(db, empleado, fecha_inicio, fecha_fin)
    return {
      dias: desglose.habiles,
      naturales: diasEntre(fecha_inicio, fecha_fin),
      enDescanso: desglose.enDescanso,
      enFestivo: desglose.enFestivo
    }
  })

  ipcMain.handle('vacaciones:crear', (event, data) => {
    const db = getDb()
    const empleado = db.prepare('SELECT * FROM empleados WHERE id = ?').get(data.empleado_id)
    if (!empleado) return { ok: false, mensaje: 'Selecciona al empleado' }
    if (empleado.estatus !== 'activo') return { ok: false, mensaje: 'El empleado está dado de baja' }
    if (!data.fecha_inicio || !data.fecha_fin) return { ok: false, mensaje: 'Captura las fechas de inicio y fin' }
    if (data.fecha_fin < data.fecha_inicio) return { ok: false, mensaje: 'La fecha de fin no puede ser anterior al inicio' }
    if (data.fecha_inicio < empleado.fecha_ingreso) {
      return { ok: false, mensaje: 'Las vacaciones no pueden empezar antes del ingreso' }
    }

    const traslape = db.prepare(
      `SELECT * FROM vacaciones
       WHERE empleado_id = ? AND estatus IN ('pendiente', 'aprobada', 'disfrutada')
         AND fecha_inicio <= ? AND fecha_fin >= ?`
    ).get(data.empleado_id, data.fecha_fin, data.fecha_inicio)
    if (traslape) {
      return { ok: false, mensaje: `Ya hay vacaciones registradas del ${traslape.fecha_inicio} al ${traslape.fecha_fin}` }
    }

    const dias = num(data.dias) || diasHabiles(db, empleado, data.fecha_inicio, data.fecha_fin)
    if (dias <= 0) return { ok: false, mensaje: 'El periodo no tiene días hábiles que descontar' }

    const saldo = saldoDe(db, empleado)
    if (dias > saldo.disponibles && !data.forzar) {
      return {
        ok: false,
        requiereConfirmacion: true,
        mensaje: `El empleado solo tiene ${saldo.disponibles} día(s) disponibles y estás registrando ${dias}. ¿Registrar de todos modos?`
      }
    }

    const info = db.prepare(
      `INSERT INTO vacaciones (empleado_id, fecha_inicio, fecha_fin, dias, periodo, motivo,
                               estatus, pagar_prima, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      data.empleado_id, data.fecha_inicio, data.fecha_fin, round2(dias),
      num(data.periodo) || saldo.anios || 1, oNulo(data.motivo),
      data.estatus === 'aprobada' ? 'aprobada' : 'pendiente',
      data.pagar_prima ? 1 : 0,
      data.usuario_id || null
    )
    return { ok: true, id: Number(info.lastInsertRowid) }
  })

  ipcMain.handle('vacaciones:resolver', (event, { id, estatus, comentario, usuario_id }) => {
    const db = getDb()
    const solicitud = db.prepare('SELECT * FROM vacaciones WHERE id = ?').get(id)
    if (!solicitud) return { ok: false, mensaje: 'Solicitud no encontrada' }

    const permitidos = ['aprobada', 'rechazada', 'cancelada', 'disfrutada']
    if (!permitidos.includes(estatus)) return { ok: false, mensaje: 'Estatus no válido' }

    db.prepare(
      `UPDATE vacaciones SET estatus = ?, comentario = ?, resuelto_por = ?, fecha_resolucion = ?
       WHERE id = ?`
    ).run(estatus, oNulo(comentario), usuario_id || null, hoy(), id)
    return { ok: true }
  })

  ipcMain.handle('vacaciones:eliminar', (event, id) => {
    getDb().prepare('DELETE FROM vacaciones WHERE id = ?').run(id)
    return { ok: true }
  })

  // --- Ajustes manuales de saldo ---

  ipcMain.handle('vacaciones:ajustes', (event, empleado_id) => {
    return getDb().prepare(
      `SELECT a.*, u.nombre AS usuario
       FROM vacaciones_ajustes a
       LEFT JOIN usuarios u ON u.id = a.usuario_id
       WHERE a.empleado_id = ? ORDER BY a.creado_en DESC`
    ).all(empleado_id)
  })

  ipcMain.handle('vacaciones:ajustar', (event, data) => {
    const db = getDb()
    const dias = num(data.dias)
    if (!dias) return { ok: false, mensaje: 'El ajuste no puede ser de 0 días' }
    if (!limpiar(data.motivo)) return { ok: false, mensaje: 'Escribe el motivo del ajuste' }
    db.prepare('INSERT INTO vacaciones_ajustes (empleado_id, dias, motivo, usuario_id) VALUES (?, ?, ?, ?)')
      .run(data.empleado_id, round2(dias), limpiar(data.motivo), data.usuario_id || null)
    return { ok: true }
  })

  ipcMain.handle('vacaciones:eliminarAjuste', (event, id) => {
    getDb().prepare('DELETE FROM vacaciones_ajustes WHERE id = ?').run(id)
    return { ok: true }
  })

  // Quien esta de vacaciones aprobadas en un rango: alimenta el calendario de ausencias.
  ipcMain.handle('vacaciones:enCurso', (event, { desde, hasta } = {}) => {
    const db = getDb()
    const d = desde || hoy()
    const h = hasta || hoy()
    return db.prepare(
      `SELECT v.*, (e.nombre || ' ' || e.apellido_paterno) AS empleado, d.nombre AS departamento
       FROM vacaciones v
       JOIN empleados e ON e.id = v.empleado_id
       LEFT JOIN departamentos d ON d.id = e.departamento_id
       WHERE v.estatus IN ('aprobada', 'disfrutada')
         AND v.fecha_inicio <= ? AND v.fecha_fin >= ?
       ORDER BY v.fecha_inicio`
    ).all(h, d)
  })
}

