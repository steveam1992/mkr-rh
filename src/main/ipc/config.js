import { app, dialog, shell } from 'electron'
import fs from 'fs'
import path from 'path'
import { rutaBase, rutaExpedientes } from '../db'
import { hoy, limpiar, oNulo, num } from '../utils'

const IMAGENES = ['png', 'jpg', 'jpeg', 'webp', 'svg']

function aDataUrl(archivo) {
  const ext = path.extname(archivo).slice(1).toLowerCase()
  const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`
  return `data:${mime};base64,${fs.readFileSync(archivo).toString('base64')}`
}

function copiarCarpeta(origen, destino) {
  if (!fs.existsSync(origen)) return
  fs.mkdirSync(destino, { recursive: true })
  for (const entrada of fs.readdirSync(origen, { withFileTypes: true })) {
    const desde = path.join(origen, entrada.name)
    const hacia = path.join(destino, entrada.name)
    if (entrada.isDirectory()) copiarCarpeta(desde, hacia)
    else fs.copyFileSync(desde, hacia)
  }
}

export function register(ipcMain, getDb) {
  ipcMain.handle('config:obtener', () => {
    return getDb().prepare('SELECT * FROM configuracion WHERE id = 1').get()
  })

  ipcMain.handle('config:guardar', (event, data) => {
    const db = getDb()
    db.prepare(
      `UPDATE configuracion
       SET nombre_empresa = ?, razon_social = ?, logo = ?, rfc = ?, registro_patronal = ?,
           direccion = ?, telefono = ?, correo = ?, dias_aguinaldo = ?, prima_vacacional = ?,
           periodo_nomina = ?, tolerancia_retardo = ?, uma_diaria = ?, subsidio_mensual = ?,
           subsidio_tope = ?
       WHERE id = 1`
    ).run(
      limpiar(data.nombre_empresa) || 'Mi Empresa',
      oNulo(data.razon_social),
      data.logo || null,
      oNulo(data.rfc),
      oNulo(data.registro_patronal),
      oNulo(data.direccion),
      oNulo(data.telefono),
      oNulo(data.correo),
      num(data.dias_aguinaldo, 15),
      num(data.prima_vacacional, 25),
      data.periodo_nomina || 'quincenal',
      num(data.tolerancia_retardo, 10),
      num(data.uma_diaria, 113.14),
      num(data.subsidio_mensual, 0),
      num(data.subsidio_tope, 0)
    )
    return { ok: true, config: db.prepare('SELECT * FROM configuracion WHERE id = 1').get() }
  })

  ipcMain.handle('config:seleccionarLogo', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Selecciona el logo de la empresa',
      filters: [{ name: 'Imágenes', extensions: IMAGENES }],
      properties: ['openFile']
    })
    if (canceled || !filePaths[0]) return { ok: false, canceled: true }
    return { ok: true, dataUrl: aDataUrl(filePaths[0]) }
  })

  // --- Tabla de vacaciones (art. 76 LFT) ---

  ipcMain.handle('config:tablaVacaciones', () => {
    return getDb().prepare('SELECT * FROM vacaciones_tabla ORDER BY anio').all()
  })

  ipcMain.handle('config:guardarTablaVacaciones', (event, filas) => {
    const db = getDb()
    const limpias = (filas || [])
      .map((f) => ({ anio: Math.trunc(num(f.anio)), dias: num(f.dias) }))
      .filter((f) => f.anio >= 1 && f.dias >= 0)
    if (limpias.length === 0) return { ok: false, mensaje: 'La tabla no puede quedar vacía' }
    if (!limpias.some((f) => f.anio === 1)) {
      return { ok: false, mensaje: 'La tabla debe incluir el año 1 de antigüedad' }
    }

    db.exec('BEGIN')
    try {
      db.exec('DELETE FROM vacaciones_tabla')
      const stmt = db.prepare('INSERT OR REPLACE INTO vacaciones_tabla (anio, dias) VALUES (?, ?)')
      for (const f of limpias) stmt.run(f.anio, f.dias)
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      return { ok: false, mensaje: 'No se pudo guardar la tabla' }
    }
    return { ok: true, tabla: db.prepare('SELECT * FROM vacaciones_tabla ORDER BY anio').all() }
  })

  // --- Tarifa del ISR ---

  ipcMain.handle('config:tarifaIsr', () => {
    return getDb().prepare('SELECT * FROM isr_tarifa ORDER BY limite_inferior').all()
  })

  ipcMain.handle('config:guardarTarifaIsr', (event, filas) => {
    const db = getDb()
    const limpias = (filas || [])
      .map((f) => ({
        limite_inferior: num(f.limite_inferior),
        limite_superior: f.limite_superior === '' || f.limite_superior == null ? null : num(f.limite_superior),
        cuota_fija: num(f.cuota_fija),
        porcentaje: num(f.porcentaje)
      }))
      .sort((a, b) => a.limite_inferior - b.limite_inferior)
    if (limpias.length === 0) return { ok: false, mensaje: 'La tarifa no puede quedar vacía' }

    db.exec('BEGIN')
    try {
      db.exec('DELETE FROM isr_tarifa')
      const stmt = db.prepare(
        'INSERT INTO isr_tarifa (limite_inferior, limite_superior, cuota_fija, porcentaje) VALUES (?, ?, ?, ?)'
      )
      for (const f of limpias) stmt.run(f.limite_inferior, f.limite_superior, f.cuota_fija, f.porcentaje)
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      return { ok: false, mensaje: 'No se pudo guardar la tarifa' }
    }
    return { ok: true, tarifa: db.prepare('SELECT * FROM isr_tarifa ORDER BY limite_inferior').all() }
  })

  // --- Dias festivos ---

  ipcMain.handle('config:festivos', (event, anio) => {
    const db = getDb()
    if (anio) {
      return db.prepare('SELECT * FROM dias_festivos WHERE fecha LIKE ? ORDER BY fecha').all(`${anio}-%`)
    }
    return db.prepare('SELECT * FROM dias_festivos ORDER BY fecha').all()
  })

  ipcMain.handle('config:agregarFestivo', (event, { fecha, descripcion }) => {
    const db = getDb()
    if (!fecha) return { ok: false, mensaje: 'Selecciona la fecha' }
    if (!limpiar(descripcion)) return { ok: false, mensaje: 'Escribe la descripción' }
    if (db.prepare('SELECT id FROM dias_festivos WHERE fecha = ?').get(fecha)) {
      return { ok: false, mensaje: 'Esa fecha ya está registrada' }
    }
    db.prepare('INSERT INTO dias_festivos (fecha, descripcion) VALUES (?, ?)').run(fecha, limpiar(descripcion))
    return { ok: true }
  })

  ipcMain.handle('config:eliminarFestivo', (event, id) => {
    getDb().prepare('DELETE FROM dias_festivos WHERE id = ?').run(id)
    return { ok: true }
  })

  // --- Respaldo ---

  ipcMain.handle('config:respaldar', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Elige dónde guardar el respaldo',
      properties: ['openDirectory', 'createDirectory']
    })
    if (canceled || !filePaths[0]) return { ok: false, canceled: true }

    const destino = path.join(filePaths[0], `respaldo-rh-${hoy()}`)
    try {
      fs.mkdirSync(destino, { recursive: true })
      fs.copyFileSync(rutaBase(), path.join(destino, 'rh.db'))
      copiarCarpeta(rutaExpedientes(), path.join(destino, 'expedientes'))
      return { ok: true, ruta: destino }
    } catch (e) {
      return { ok: false, mensaje: `No se pudo crear el respaldo: ${e.message}` }
    }
  })

  ipcMain.handle('config:restaurar', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Selecciona el archivo rh.db del respaldo',
      filters: [{ name: 'Base de datos', extensions: ['db'] }],
      properties: ['openFile']
    })
    if (canceled || !filePaths[0]) return { ok: false, canceled: true }

    const origen = filePaths[0]
    const confirmacion = await dialog.showMessageBox({
      type: 'warning',
      buttons: ['Cancelar', 'Restaurar y reiniciar'],
      defaultId: 0,
      cancelId: 0,
      title: 'Restaurar respaldo',
      message: 'Se reemplazarán todos los datos actuales por los del respaldo.',
      detail: 'Esta acción no se puede deshacer. La aplicación se reiniciará al terminar.'
    })
    if (confirmacion.response !== 1) return { ok: false, canceled: true }

    try {
      // La base actual se guarda a un lado por si el respaldo viniera corrupto.
      fs.copyFileSync(rutaBase(), `${rutaBase()}.anterior`)
      fs.copyFileSync(origen, rutaBase())

      const expedientesRespaldo = path.join(path.dirname(origen), 'expedientes')
      if (fs.existsSync(expedientesRespaldo)) copiarCarpeta(expedientesRespaldo, rutaExpedientes())

      app.relaunch()
      app.exit(0)
      return { ok: true }
    } catch (e) {
      return { ok: false, mensaje: `No se pudo restaurar: ${e.message}` }
    }
  })

  ipcMain.handle('config:abrirCarpetaDatos', () => {
    shell.openPath(app.getPath('userData'))
    return { ok: true }
  })
}
