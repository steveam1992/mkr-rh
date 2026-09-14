import { oNulo, num, hoy, round2, diasEntre } from '../utils'

const TIPOS = ['con_goce', 'sin_goce', 'falta', 'retardo', 'home_office', 'otro']

// Solo el permiso sin goce y la falta injustificada descuentan por omision.
const DESCUENTA_POR_DEFECTO = { sin_goce: 1, falta: 1 }

export function register(ipcMain, getDb) {
  ipcMain.handle('permisos:listar', (event, filtros = {}) => {
    const db = getDb()
    const condiciones = []
    const params = []

    if (filtros.empleado_id) {
      condiciones.push('p.empleado_id = ?')
      params.push(filtros.empleado_id)
    }
    if (filtros.tipo && filtros.tipo !== 'todos') {
      condiciones.push('p.tipo = ?')
      params.push(filtros.tipo)
    }
    if (filtros.estatus && filtros.estatus !== 'todos') {
      condiciones.push('p.estatus = ?')
      params.push(filtros.estatus)
    }
    if (filtros.desde) {
      condiciones.push('p.fecha_fin >= ?')
      params.push(filtros.desde)
    }
    if (filtros.hasta) {
      condiciones.push('p.fecha_inicio <= ?')
      params.push(filtros.hasta)
    }
    if (filtros.departamento_id) {
      condiciones.push('e.departamento_id = ?')
      params.push(filtros.departamento_id)
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''
    return db.prepare(
      `SELECT p.*, (e.nombre || ' ' || e.apellido_paterno || ' ' || COALESCE(e.apellido_materno, '')) AS empleado,
              e.numero_empleado, e.salario_diario, d.nombre AS departamento, u.nombre AS resuelto_por_nombre
       FROM permisos p
       JOIN empleados e ON e.id = p.empleado_id
       LEFT JOIN departamentos d ON d.id = e.departamento_id
       LEFT JOIN usuarios u ON u.id = p.resuelto_por
       ${where}
       ORDER BY p.fecha_inicio DESC`
    ).all(...params).map((p) => ({
      ...p,
      descuento_estimado: p.descuenta ? round2(num(p.salario_diario) * num(p.dias)) : 0
    }))
  })

  ipcMain.handle('permisos:crear', (event, data) => {
    const db = getDb()
    const empleado = db.prepare('SELECT * FROM empleados WHERE id = ?').get(data.empleado_id)
    if (!empleado) return { ok: false, mensaje: 'Selecciona al empleado' }
    if (empleado.estatus !== 'activo') return { ok: false, mensaje: 'El empleado está dado de baja' }
    if (!data.fecha_inicio) return { ok: false, mensaje: 'Selecciona la fecha' }

    const tipo = TIPOS.includes(data.tipo) ? data.tipo : 'con_goce'
    const fechaFin = data.fecha_fin || data.fecha_inicio
    if (fechaFin < data.fecha_inicio) return { ok: false, mensaje: 'La fecha de fin no puede ser anterior al inicio' }

    const traslape = db.prepare(
      `SELECT * FROM permisos
       WHERE empleado_id = ? AND estatus IN ('pendiente', 'aprobado')
         AND fecha_inicio <= ? AND fecha_fin >= ?`
    ).get(data.empleado_id, fechaFin, data.fecha_inicio)
    if (traslape) {
      return { ok: false, mensaje: `Ya hay un registro del ${traslape.fecha_inicio} al ${traslape.fecha_fin}` }
    }

    // El retardo se mide en horas; los demas tipos, en dias.
    const dias = tipo === 'retardo' ? 0 : num(data.dias) || diasEntre(data.fecha_inicio, fechaFin)
    const horas = tipo === 'retardo' ? num(data.horas) : num(data.horas)
    const descuenta = data.descuenta == null ? (DESCUENTA_POR_DEFECTO[tipo] || 0) : (data.descuenta ? 1 : 0)

    const info = db.prepare(
      `INSERT INTO permisos (empleado_id, tipo, fecha_inicio, fecha_fin, dias, horas, motivo,
                             estatus, descuenta, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      data.empleado_id, tipo, data.fecha_inicio, fechaFin, round2(dias), round2(horas),
      oNulo(data.motivo),
      // Las faltas y retardos son hechos consumados, no solicitudes que se aprueben.
      ['falta', 'retardo'].includes(tipo) ? 'aprobado' : (data.estatus || 'pendiente'),
      descuenta,
      data.usuario_id || null
    )
    return { ok: true, id: Number(info.lastInsertRowid) }
  })

  ipcMain.handle('permisos:resolver', (event, { id, estatus, comentario, usuario_id }) => {
    const db = getDb()
    if (!['aprobado', 'rechazado', 'cancelado'].includes(estatus)) {
      return { ok: false, mensaje: 'Estatus no válido' }
    }
    if (!db.prepare('SELECT id FROM permisos WHERE id = ?').get(id)) {
      return { ok: false, mensaje: 'Registro no encontrado' }
    }
    db.prepare(
      'UPDATE permisos SET estatus = ?, comentario = ?, resuelto_por = ?, fecha_resolucion = ? WHERE id = ?'
    ).run(estatus, oNulo(comentario), usuario_id || null, hoy(), id)
    return { ok: true }
  })

  ipcMain.handle('permisos:actualizar', (event, { id, data }) => {
    const db = getDb()
    const previo = db.prepare('SELECT * FROM permisos WHERE id = ?').get(id)
    if (!previo) return { ok: false, mensaje: 'Registro no encontrado' }
    const fechaFin = data.fecha_fin || data.fecha_inicio
    if (fechaFin < data.fecha_inicio) return { ok: false, mensaje: 'La fecha de fin no puede ser anterior al inicio' }

    const tipo = TIPOS.includes(data.tipo) ? data.tipo : previo.tipo
    db.prepare(
      `UPDATE permisos SET tipo = ?, fecha_inicio = ?, fecha_fin = ?, dias = ?, horas = ?,
                           motivo = ?, descuenta = ? WHERE id = ?`
    ).run(
      tipo, data.fecha_inicio, fechaFin,
      round2(num(data.dias) || diasEntre(data.fecha_inicio, fechaFin)),
      round2(num(data.horas)), oNulo(data.motivo), data.descuenta ? 1 : 0, id
    )
    return { ok: true }
  })

  ipcMain.handle('permisos:eliminar', (event, id) => {
    getDb().prepare('DELETE FROM permisos WHERE id = ?').run(id)
    return { ok: true }
  })

  ipcMain.handle('permisos:enCurso', (event, { fecha } = {}) => {
    const dia = fecha || hoy()
    return getDb().prepare(
      `SELECT p.*, (e.nombre || ' ' || e.apellido_paterno) AS empleado, d.nombre AS departamento
       FROM permisos p
       JOIN empleados e ON e.id = p.empleado_id
       LEFT JOIN departamentos d ON d.id = e.departamento_id
       WHERE p.estatus = 'aprobado' AND p.fecha_inicio <= ? AND p.fecha_fin >= ? AND e.estatus = 'activo'
       ORDER BY p.tipo`
    ).all(dia, dia)
  })
}
