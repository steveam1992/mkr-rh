import { oNulo, num, hoy, round2, diasEntre } from '../utils'

const TIPOS = ['enfermedad_general', 'riesgo_trabajo', 'maternidad', 'pat']

// El porcentaje del salario que cubre el IMSS depende del ramo (arts. 58, 96 y 101 LSS).
const PORCENTAJE_POR_TIPO = {
  enfermedad_general: 60,
  riesgo_trabajo: 100,
  maternidad: 100,
  pat: 100
}

export function register(ipcMain, getDb) {
  ipcMain.handle('incapacidades:listar', (event, filtros = {}) => {
    const db = getDb()
    const condiciones = []
    const params = []

    if (filtros.empleado_id) {
      condiciones.push('i.empleado_id = ?')
      params.push(filtros.empleado_id)
    }
    if (filtros.tipo && filtros.tipo !== 'todos') {
      condiciones.push('i.tipo = ?')
      params.push(filtros.tipo)
    }
    if (filtros.desde) {
      condiciones.push('i.fecha_fin >= ?')
      params.push(filtros.desde)
    }
    if (filtros.hasta) {
      condiciones.push('i.fecha_inicio <= ?')
      params.push(filtros.hasta)
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''
    return db.prepare(
      `SELECT i.*, (e.nombre || ' ' || e.apellido_paterno || ' ' || COALESCE(e.apellido_materno, '')) AS empleado,
              e.numero_empleado, e.nss, e.salario_diario, d.nombre AS departamento
       FROM incapacidades i
       JOIN empleados e ON e.id = i.empleado_id
       LEFT JOIN departamentos d ON d.id = e.departamento_id
       ${where}
       ORDER BY i.fecha_inicio DESC`
    ).all(...params).map((i) => ({
      ...i,
      vigente: i.fecha_inicio <= hoy() && i.fecha_fin >= hoy(),
      // Referencia de cuanto representa el subsidio a cargo del IMSS en el periodo.
      subsidio_estimado: round2((num(i.salario_diario) * num(i.porcentaje_pago) / 100) * num(i.dias))
    }))
  })

  ipcMain.handle('incapacidades:crear', (event, data) => {
    const db = getDb()
    const validacion = validar(db, data)
    if (validacion) return { ok: false, mensaje: validacion }

    const dias = num(data.dias) || diasEntre(data.fecha_inicio, data.fecha_fin)
    const tipo = TIPOS.includes(data.tipo) ? data.tipo : 'enfermedad_general'
    const porcentaje = data.porcentaje_pago == null || data.porcentaje_pago === ''
      ? PORCENTAJE_POR_TIPO[tipo]
      : num(data.porcentaje_pago)

    const info = db.prepare(
      `INSERT INTO incapacidades (empleado_id, folio, tipo, fecha_inicio, fecha_fin, dias,
                                  porcentaje_pago, control, notas, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      data.empleado_id, oNulo(data.folio), tipo, data.fecha_inicio, data.fecha_fin, dias,
      porcentaje, data.control || 'inicial', oNulo(data.notas), data.usuario_id || null
    )
    return { ok: true, id: Number(info.lastInsertRowid) }
  })

  ipcMain.handle('incapacidades:actualizar', (event, { id, data }) => {
    const db = getDb()
    const validacion = validar(db, data, id)
    if (validacion) return { ok: false, mensaje: validacion }

    const dias = num(data.dias) || diasEntre(data.fecha_inicio, data.fecha_fin)
    const tipo = TIPOS.includes(data.tipo) ? data.tipo : 'enfermedad_general'

    db.prepare(
      `UPDATE incapacidades
       SET folio = ?, tipo = ?, fecha_inicio = ?, fecha_fin = ?, dias = ?, porcentaje_pago = ?,
           control = ?, notas = ?
       WHERE id = ?`
    ).run(
      oNulo(data.folio), tipo, data.fecha_inicio, data.fecha_fin, dias,
      num(data.porcentaje_pago, PORCENTAJE_POR_TIPO[tipo]), data.control || 'inicial',
      oNulo(data.notas), id
    )
    return { ok: true }
  })

  ipcMain.handle('incapacidades:eliminar', (event, id) => {
    getDb().prepare('DELETE FROM incapacidades WHERE id = ?').run(id)
    return { ok: true }
  })

  ipcMain.handle('incapacidades:vigentes', (event, { fecha } = {}) => {
    const dia = fecha || hoy()
    return getDb().prepare(
      `SELECT i.*, (e.nombre || ' ' || e.apellido_paterno) AS empleado, d.nombre AS departamento
       FROM incapacidades i
       JOIN empleados e ON e.id = i.empleado_id
       LEFT JOIN departamentos d ON d.id = e.departamento_id
       WHERE i.fecha_inicio <= ? AND i.fecha_fin >= ? AND e.estatus = 'activo'
       ORDER BY i.fecha_inicio`
    ).all(dia, dia)
  })

  // Resumen anual por tipo: util para ver si un area concentra riesgos de trabajo.
  ipcMain.handle('incapacidades:resumen', (event, { anio } = {}) => {
    const y = anio || new Date().getFullYear()
    return getDb().prepare(
      `SELECT i.tipo, COUNT(*) AS casos, COALESCE(SUM(i.dias), 0) AS dias,
              COUNT(DISTINCT i.empleado_id) AS empleados
       FROM incapacidades i
       WHERE i.fecha_inicio LIKE ?
       GROUP BY i.tipo ORDER BY dias DESC`
    ).all(`${y}-%`)
  })
}

function validar(db, data, idActual = null) {
  if (!data.empleado_id) return 'Selecciona al empleado'
  if (!db.prepare('SELECT id FROM empleados WHERE id = ?').get(data.empleado_id)) {
    return 'Empleado no encontrado'
  }
  if (!data.fecha_inicio || !data.fecha_fin) return 'Captura las fechas de inicio y fin'
  if (data.fecha_fin < data.fecha_inicio) return 'La fecha de fin no puede ser anterior al inicio'

  const params = [data.empleado_id, data.fecha_fin, data.fecha_inicio]
  let sql = 'SELECT * FROM incapacidades WHERE empleado_id = ? AND fecha_inicio <= ? AND fecha_fin >= ?'
  if (idActual) {
    sql += ' AND id <> ?'
    params.push(idActual)
  }
  const traslape = db.prepare(sql).get(...params)
  if (traslape) {
    return `Ya hay una incapacidad del ${traslape.fecha_inicio} al ${traslape.fecha_fin}`
  }
  return null
}
