import { hashPassword, verifyPassword } from '../db'
import { limpiar } from '../utils'

const ROLES = ['admin', 'rh', 'supervisor', 'consulta']

function toPublic(row) {
  if (!row) return null
  return { id: row.id, usuario: row.usuario, nombre: row.nombre, rol: row.rol, activo: !!row.activo }
}

export function register(ipcMain, getDb) {
  ipcMain.handle('auth:login', (event, { usuario, password }) => {
    const db = getDb()
    const row = db.prepare('SELECT * FROM usuarios WHERE usuario = ? AND activo = 1').get(usuario || '')
    if (!row || !verifyPassword(password || '', row.salt, row.password_hash)) {
      return { ok: false, mensaje: 'Usuario o contraseña incorrectos' }
    }
    return { ok: true, usuario: toPublic(row) }
  })

  ipcMain.handle('auth:listarUsuarios', () => {
    const db = getDb()
    return db.prepare('SELECT id, usuario, nombre, rol, activo FROM usuarios ORDER BY nombre').all().map(toPublic)
  })

  ipcMain.handle('auth:crearUsuario', (event, { usuario, password, nombre, rol }) => {
    const db = getDb()
    const user = limpiar(usuario)
    if (!user) return { ok: false, mensaje: 'Escribe el nombre de usuario' }
    if (/\s/.test(user)) return { ok: false, mensaje: 'El nombre de usuario no puede llevar espacios' }
    if (!limpiar(nombre)) return { ok: false, mensaje: 'Escribe el nombre de la persona' }
    if ((password || '').length < 4) return { ok: false, mensaje: 'La contraseña debe tener al menos 4 caracteres' }
    if (db.prepare('SELECT id FROM usuarios WHERE usuario = ?').get(user)) {
      return { ok: false, mensaje: 'Ese nombre de usuario ya existe' }
    }

    const { hash, salt } = hashPassword(password)
    const info = db.prepare(
      'INSERT INTO usuarios (usuario, password_hash, salt, nombre, rol) VALUES (?, ?, ?, ?, ?)'
    ).run(user, hash, salt, limpiar(nombre), ROLES.includes(rol) ? rol : 'consulta')
    return { ok: true, usuario: toPublic(db.prepare('SELECT * FROM usuarios WHERE id = ?').get(info.lastInsertRowid)) }
  })

  ipcMain.handle('auth:actualizarUsuario', (event, { id, nombre, rol }) => {
    const db = getDb()
    const row = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id)
    if (!row) return { ok: false, mensaje: 'Usuario no encontrado' }
    if (row.rol === 'admin' && rol !== 'admin' && quedaUnSoloAdmin(db)) {
      return { ok: false, mensaje: 'Debe quedar al menos un administrador activo' }
    }
    db.prepare('UPDATE usuarios SET nombre = ?, rol = ? WHERE id = ?')
      .run(limpiar(nombre) || row.nombre, ROLES.includes(rol) ? rol : row.rol, id)
    return { ok: true, usuario: toPublic(db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id)) }
  })

  ipcMain.handle('auth:toggleActivo', (event, { id, activo }) => {
    const db = getDb()
    const row = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id)
    if (!row) return { ok: false, mensaje: 'Usuario no encontrado' }
    if (!activo && row.rol === 'admin' && quedaUnSoloAdmin(db)) {
      return { ok: false, mensaje: 'Debe quedar al menos un administrador activo' }
    }
    db.prepare('UPDATE usuarios SET activo = ? WHERE id = ?').run(activo ? 1 : 0, id)
    return { ok: true }
  })

  ipcMain.handle('auth:eliminarUsuario', (event, id) => {
    const db = getDb()
    const row = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id)
    if (!row) return { ok: false, mensaje: 'Usuario no encontrado' }
    if (row.activo) return { ok: false, mensaje: 'Primero desactiva al usuario para poder eliminarlo' }
    try {
      db.prepare('DELETE FROM usuarios WHERE id = ?').run(id)
      return { ok: true }
    } catch (e) {
      return {
        ok: false,
        mensaje: 'No se puede eliminar: el usuario tiene movimientos registrados a su nombre'
      }
    }
  })

  ipcMain.handle('auth:cambiarPassword', (event, { usuario_id, passwordActual, passwordNueva }) => {
    const db = getDb()
    const row = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(usuario_id)
    if (!row || !verifyPassword(passwordActual || '', row.salt, row.password_hash)) {
      return { ok: false, mensaje: 'La contraseña actual no es correcta' }
    }
    if ((passwordNueva || '').length < 4) {
      return { ok: false, mensaje: 'La contraseña nueva debe tener al menos 4 caracteres' }
    }
    const { hash, salt } = hashPassword(passwordNueva)
    db.prepare('UPDATE usuarios SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, usuario_id)
    return { ok: true }
  })

  // Restablecer la contrasena de otra cuenta: solo tiene sentido para un administrador,
  // el renderer ya oculta la accion para los demas roles.
  ipcMain.handle('auth:restablecerPassword', (event, { id, passwordNueva }) => {
    const db = getDb()
    if (!db.prepare('SELECT id FROM usuarios WHERE id = ?').get(id)) {
      return { ok: false, mensaje: 'Usuario no encontrado' }
    }
    if ((passwordNueva || '').length < 4) {
      return { ok: false, mensaje: 'La contraseña debe tener al menos 4 caracteres' }
    }
    const { hash, salt } = hashPassword(passwordNueva)
    db.prepare('UPDATE usuarios SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, id)
    return { ok: true }
  })
}

function quedaUnSoloAdmin(db) {
  return db.prepare("SELECT COUNT(*) AS n FROM usuarios WHERE rol = 'admin' AND activo = 1").get().n <= 1
}
