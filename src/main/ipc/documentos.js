import { dialog, shell } from 'electron'
import fs from 'fs'
import path from 'path'
import { rutaExpedientes } from '../db'
import { limpiar, oNulo, hoy, sumarDias } from '../utils'

const EXTENSIONES = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'doc', 'docx', 'xls', 'xlsx', 'txt']
const MAX_BYTES = 25 * 1024 * 1024

// Los archivos se copian al userData en lugar de guardar la ruta original: si el usuario
// mueve o borra el archivo de su escritorio, el expediente sigue completo.
function carpetaEmpleado(empleado_id) {
  const dir = path.join(rutaExpedientes(), String(empleado_id))
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function nombreSeguro(nombre) {
  return nombre.replace(/[^a-zA-Z0-9._\- áéíóúÁÉÍÓÚñÑ]/g, '_').slice(0, 120)
}

function rutaAbsoluta(relativa) {
  return path.join(rutaExpedientes(), relativa)
}

export function register(ipcMain, getDb) {
  ipcMain.handle('documentos:listar', (event, empleado_id) => {
    const filas = getDb().prepare(
      `SELECT d.*, u.nombre AS usuario
       FROM documentos d
       LEFT JOIN usuarios u ON u.id = d.usuario_id
       WHERE d.empleado_id = ? ORDER BY d.creado_en DESC`
    ).all(empleado_id)
    return filas.map((d) => ({ ...d, existe: fs.existsSync(rutaAbsoluta(d.archivo)) }))
  })

  ipcMain.handle('documentos:agregar', async (event, data) => {
    const db = getDb()
    if (!db.prepare('SELECT id FROM empleados WHERE id = ?').get(data.empleado_id)) {
      return { ok: false, mensaje: 'Empleado no encontrado' }
    }

    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Selecciona el documento',
      filters: [{ name: 'Documentos', extensions: EXTENSIONES }],
      properties: ['openFile']
    })
    if (canceled || !filePaths[0]) return { ok: false, canceled: true }

    const origen = filePaths[0]
    const stat = fs.statSync(origen)
    if (stat.size > MAX_BYTES) return { ok: false, mensaje: 'El archivo no debe pasar de 25 MB' }

    const extension = path.extname(origen).slice(1).toLowerCase()
    const base = nombreSeguro(path.basename(origen))
    const destinoNombre = `${Date.now()}-${base}`
    const relativa = path.join(String(data.empleado_id), destinoNombre)

    try {
      fs.copyFileSync(origen, path.join(carpetaEmpleado(data.empleado_id), destinoNombre))
    } catch (e) {
      return { ok: false, mensaje: `No se pudo copiar el archivo: ${e.message}` }
    }

    const info = db.prepare(
      `INSERT INTO documentos (empleado_id, tipo, nombre, archivo, extension, tamano,
                               fecha_emision, fecha_vencimiento, notas, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      data.empleado_id,
      data.tipo || 'otro',
      limpiar(data.nombre) || path.basename(origen, path.extname(origen)),
      relativa,
      extension,
      stat.size,
      oNulo(data.fecha_emision),
      oNulo(data.fecha_vencimiento),
      oNulo(data.notas),
      data.usuario_id || null
    )
    return { ok: true, documento: db.prepare('SELECT * FROM documentos WHERE id = ?').get(info.lastInsertRowid) }
  })

  ipcMain.handle('documentos:actualizar', (event, { id, data }) => {
    const db = getDb()
    if (!limpiar(data.nombre)) return { ok: false, mensaje: 'Escribe el nombre del documento' }
    db.prepare(
      `UPDATE documentos SET tipo = ?, nombre = ?, fecha_emision = ?, fecha_vencimiento = ?, notas = ?
       WHERE id = ?`
    ).run(
      data.tipo || 'otro',
      limpiar(data.nombre),
      oNulo(data.fecha_emision),
      oNulo(data.fecha_vencimiento),
      oNulo(data.notas),
      id
    )
    return { ok: true, documento: db.prepare('SELECT * FROM documentos WHERE id = ?').get(id) }
  })

  ipcMain.handle('documentos:abrir', (event, id) => {
    const db = getDb()
    const doc = db.prepare('SELECT * FROM documentos WHERE id = ?').get(id)
    if (!doc) return { ok: false, mensaje: 'Documento no encontrado' }
    const ruta = rutaAbsoluta(doc.archivo)
    if (!fs.existsSync(ruta)) return { ok: false, mensaje: 'El archivo ya no está en el expediente' }
    shell.openPath(ruta)
    return { ok: true }
  })

  ipcMain.handle('documentos:exportar', async (event, id) => {
    const db = getDb()
    const doc = db.prepare('SELECT * FROM documentos WHERE id = ?').get(id)
    if (!doc) return { ok: false, mensaje: 'Documento no encontrado' }
    const ruta = rutaAbsoluta(doc.archivo)
    if (!fs.existsSync(ruta)) return { ok: false, mensaje: 'El archivo ya no está en el expediente' }

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Guardar copia del documento',
      defaultPath: `${doc.nombre}.${doc.extension || 'pdf'}`
    })
    if (canceled || !filePath) return { ok: false, canceled: true }

    try {
      fs.copyFileSync(ruta, filePath)
      return { ok: true, ruta: filePath }
    } catch (e) {
      return { ok: false, mensaje: `No se pudo guardar la copia: ${e.message}` }
    }
  })

  ipcMain.handle('documentos:eliminar', (event, id) => {
    const db = getDb()
    const doc = db.prepare('SELECT * FROM documentos WHERE id = ?').get(id)
    if (!doc) return { ok: false, mensaje: 'Documento no encontrado' }

    db.prepare('DELETE FROM documentos WHERE id = ?').run(id)
    try {
      const ruta = rutaAbsoluta(doc.archivo)
      if (fs.existsSync(ruta)) fs.unlinkSync(ruta)
    } catch (e) {
      // El registro ya se borro; que el archivo quede huerfano no rompe nada.
    }
    return { ok: true }
  })

  // Documentos vencidos o por vencer dentro de los proximos N dias.
  ipcMain.handle('documentos:porVencer', (event, { dias = 60 } = {}) => {
    const limite = sumarDias(hoy(), dias)
    return getDb().prepare(
      `SELECT d.id, d.nombre, d.tipo, d.fecha_vencimiento, d.empleado_id,
              (e.nombre || ' ' || e.apellido_paterno) AS empleado
       FROM documentos d
       JOIN empleados e ON e.id = d.empleado_id
       WHERE d.fecha_vencimiento IS NOT NULL
         AND d.fecha_vencimiento <= ?
         AND e.estatus = 'activo'
       ORDER BY d.fecha_vencimiento`
    ).all(limite)
  })

  ipcMain.handle('documentos:abrirCarpeta', (event, empleado_id) => {
    shell.openPath(carpetaEmpleado(empleado_id))
    return { ok: true }
  })
}
