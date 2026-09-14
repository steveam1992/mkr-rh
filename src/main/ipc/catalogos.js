import { limpiar, oNulo, num } from '../utils'

export function register(ipcMain, getDb) {
  // --- Departamentos ---

  ipcMain.handle('catalogos:departamentos', (event, { incluirInactivos } = {}) => {
    const db = getDb()
    const filtro = incluirInactivos ? '' : 'WHERE d.activo = 1'
    return db.prepare(
      `SELECT d.*,
              (SELECT COUNT(*) FROM empleados e WHERE e.departamento_id = d.id AND e.estatus = 'activo') AS empleados
       FROM departamentos d ${filtro} ORDER BY d.nombre`
    ).all()
  })

  ipcMain.handle('catalogos:crearDepartamento', (event, data) => {
    const db = getDb()
    const nombre = limpiar(data.nombre)
    if (!nombre) return { ok: false, mensaje: 'Escribe el nombre del departamento' }
    if (db.prepare('SELECT id FROM departamentos WHERE nombre = ? AND activo = 1').get(nombre)) {
      return { ok: false, mensaje: 'Ya existe un departamento con ese nombre' }
    }
    const info = db.prepare('INSERT INTO departamentos (nombre, descripcion) VALUES (?, ?)')
      .run(nombre, oNulo(data.descripcion))
    return { ok: true, departamento: db.prepare('SELECT * FROM departamentos WHERE id = ?').get(info.lastInsertRowid) }
  })

  ipcMain.handle('catalogos:actualizarDepartamento', (event, { id, data }) => {
    const db = getDb()
    const nombre = limpiar(data.nombre)
    if (!nombre) return { ok: false, mensaje: 'Escribe el nombre del departamento' }
    db.prepare('UPDATE departamentos SET nombre = ?, descripcion = ? WHERE id = ?')
      .run(nombre, oNulo(data.descripcion), id)
    return { ok: true, departamento: db.prepare('SELECT * FROM departamentos WHERE id = ?').get(id) }
  })

  ipcMain.handle('catalogos:eliminarDepartamento', (event, id) => {
    const db = getDb()
    const enUso = db.prepare(
      "SELECT COUNT(*) AS n FROM empleados WHERE departamento_id = ? AND estatus = 'activo'"
    ).get(id).n
    if (enUso > 0) {
      return { ok: false, mensaje: `No se puede eliminar: hay ${enUso} empleado(s) activo(s) en este departamento` }
    }
    db.prepare('UPDATE departamentos SET activo = 0 WHERE id = ?').run(id)
    return { ok: true }
  })

  // --- Puestos ---

  ipcMain.handle('catalogos:puestos', (event, { departamento_id, incluirInactivos } = {}) => {
    const db = getDb()
    const condiciones = []
    const params = []
    if (!incluirInactivos) condiciones.push('p.activo = 1')
    if (departamento_id) {
      condiciones.push('p.departamento_id = ?')
      params.push(departamento_id)
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''
    return db.prepare(
      `SELECT p.*, d.nombre AS departamento,
              (SELECT COUNT(*) FROM empleados e WHERE e.puesto_id = p.id AND e.estatus = 'activo') AS empleados
       FROM puestos p
       LEFT JOIN departamentos d ON d.id = p.departamento_id
       ${where} ORDER BY d.nombre, p.nombre`
    ).all(...params)
  })

  ipcMain.handle('catalogos:crearPuesto', (event, data) => {
    const db = getDb()
    const nombre = limpiar(data.nombre)
    if (!nombre) return { ok: false, mensaje: 'Escribe el nombre del puesto' }
    const info = db.prepare(
      'INSERT INTO puestos (nombre, departamento_id, descripcion, salario_min, salario_max) VALUES (?, ?, ?, ?, ?)'
    ).run(nombre, data.departamento_id || null, oNulo(data.descripcion), num(data.salario_min), num(data.salario_max))
    return { ok: true, puesto: db.prepare('SELECT * FROM puestos WHERE id = ?').get(info.lastInsertRowid) }
  })

  ipcMain.handle('catalogos:actualizarPuesto', (event, { id, data }) => {
    const db = getDb()
    const nombre = limpiar(data.nombre)
    if (!nombre) return { ok: false, mensaje: 'Escribe el nombre del puesto' }
    db.prepare(
      'UPDATE puestos SET nombre = ?, departamento_id = ?, descripcion = ?, salario_min = ?, salario_max = ? WHERE id = ?'
    ).run(nombre, data.departamento_id || null, oNulo(data.descripcion), num(data.salario_min), num(data.salario_max), id)
    return { ok: true, puesto: db.prepare('SELECT * FROM puestos WHERE id = ?').get(id) }
  })

  ipcMain.handle('catalogos:eliminarPuesto', (event, id) => {
    const db = getDb()
    const enUso = db.prepare(
      "SELECT COUNT(*) AS n FROM empleados WHERE puesto_id = ? AND estatus = 'activo'"
    ).get(id).n
    if (enUso > 0) {
      return { ok: false, mensaje: `No se puede eliminar: hay ${enUso} empleado(s) activo(s) con este puesto` }
    }
    db.prepare('UPDATE puestos SET activo = 0 WHERE id = ?').run(id)
    return { ok: true }
  })
}
