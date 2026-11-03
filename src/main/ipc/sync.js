import { hashPassword } from '../db'

// Sincronizacion con la API (MKR RH v2). La app sigue funcionando sin internet: esto solo
// configura a que servidor/empresa se conecta este equipo y muestra el estado.
export function register(ipcMain, getDb, sync, vivo) {
  const seguro = async (fn) => {
    try {
      return { ok: true, ...(await fn()) }
    } catch (e) {
      return { ok: false, mensaje: e.message }
    }
  }

  const estado = () => ({ ...sync.estado(), tiempo_real: vivo.estado() })

  ipcMain.handle('sync:estado', () => estado())

  ipcMain.handle('sync:conectar', (event, { url, empresa, usuario, password, equipoPrincipal }) =>
    seguro(async () => {
      sync.configurar({ url: String(url || '').trim(), empresa: String(empresa || '').trim().toLowerCase() })
      const sesion = await sync.iniciarSesion({ usuario, password, equipoPrincipal: !!equipoPrincipal })
      vivo.iniciar()
      // Primera sincronizacion en segundo plano: puede ser larga y no debe congelar la pantalla.
      sync.sincronizar().catch((e) => console.warn('[sync]', e.message))
      return { sesion }
    })
  )

  ipcMain.handle('sync:ahora', () => seguro(async () => ({ resultado: await sync.sincronizar() })))

  ipcMain.handle('sync:reenviarTodo', () =>
    seguro(async () => {
      sync.reenviarTodo()
      return { resultado: await sync.sincronizar() }
    })
  )

  ipcMain.handle('sync:desconectar', () => {
    vivo.detener()
    sync.cerrarSesion()
    return estado()
  })

  ipcMain.handle('sync:avisos', () => sync.avisos())
  ipcMain.handle('sync:marcarAvisosVistos', () => {
    sync.marcarAvisosVistos()
    return true
  })

  // PIN de marcaje por web: se guarda solo su hash (mismo scrypt que las contrasenas) y viaja
  // con el empleado. El PIN en claro nunca se almacena.
  ipcMain.handle('sync:pinEmpleado', (event, id) => {
    const e = getDb().prepare("SELECT (pin_hash <> '') AS tiene_pin FROM empleados WHERE id = ?").get(id)
    return { tiene_pin: !!e?.tiene_pin }
  })

  ipcMain.handle('sync:establecerPin', (event, { id, pin }) => {
    if (!/^\d{4,8}$/.test(String(pin || ''))) return { ok: false, mensaje: 'El PIN debe tener de 4 a 8 dígitos' }
    const { hash, salt } = hashPassword(String(pin))
    const r = getDb().prepare('UPDATE empleados SET pin_hash = ?, pin_salt = ? WHERE id = ?').run(hash, salt, id)
    if (!r.changes) return { ok: false, mensaje: 'Empleado no encontrado' }
    sync.sincronizar().catch(() => {}) // el trigger ya lo marco pendiente; si no hay red sube despues
    return { ok: true }
  })
}
