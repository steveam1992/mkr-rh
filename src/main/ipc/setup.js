import { hashPassword, requiereSetup } from '../db'
import { limpiar, oNulo } from '../utils'

export function register(ipcMain, getDb) {
  ipcMain.handle('setup:estado', () => {
    return { requiereSetup: requiereSetup() }
  })

  ipcMain.handle('setup:completar', (event, data) => {
    const db = getDb()
    if (!requiereSetup()) {
      return { ok: false, mensaje: 'La configuración inicial ya fue realizada en este equipo' }
    }

    const nombreEmpresa = limpiar(data?.nombre_empresa)
    const usuario = limpiar(data?.usuario)
    const nombre = limpiar(data?.nombre)
    const password = data?.password || ''

    if (!nombreEmpresa) return { ok: false, mensaje: 'Escribe el nombre de la empresa' }
    if (!usuario) return { ok: false, mensaje: 'Escribe el nombre de usuario del administrador' }
    if (/\s/.test(usuario)) return { ok: false, mensaje: 'El nombre de usuario no puede llevar espacios' }
    if (!nombre) return { ok: false, mensaje: 'Escribe el nombre del administrador' }
    if (password.length < 4) return { ok: false, mensaje: 'La contraseña debe tener al menos 4 caracteres' }

    const { hash, salt } = hashPassword(password)

    db.exec('BEGIN')
    try {
      if (db.prepare('SELECT id FROM usuarios WHERE usuario = ?').get(usuario)) {
        db.exec('ROLLBACK')
        return { ok: false, mensaje: 'Ese nombre de usuario ya existe' }
      }

      const info = db.prepare(
        'INSERT INTO usuarios (usuario, password_hash, salt, nombre, rol) VALUES (?, ?, ?, ?, ?)'
      ).run(usuario, hash, salt, nombre, 'admin')

      db.prepare(
        `UPDATE configuracion
         SET nombre_empresa = ?, razon_social = ?, rfc = ?, logo = ?, direccion = ?,
             telefono = ?, correo = ?, setup_completado = 1
         WHERE id = 1`
      ).run(
        nombreEmpresa,
        oNulo(data?.razon_social),
        oNulo(data?.rfc),
        oNulo(data?.logo),
        oNulo(data?.direccion),
        oNulo(data?.telefono),
        oNulo(data?.correo)
      )
      db.exec('COMMIT')

      const row = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(info.lastInsertRowid)
      return {
        ok: true,
        usuario: { id: row.id, usuario: row.usuario, nombre: row.nombre, rol: row.rol, activo: !!row.activo },
        config: db.prepare('SELECT * FROM configuracion WHERE id = 1').get()
      }
    } catch (e) {
      db.exec('ROLLBACK')
      return { ok: false, mensaje: 'No se pudo guardar la configuración inicial' }
    }
  })
}
