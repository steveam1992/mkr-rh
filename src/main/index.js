import { app, BrowserWindow, Menu, ipcMain } from 'electron'
import path from 'path'
import * as db from './db'
import { registerIpc } from './ipc'
import { crearSync } from './sync/mkrrh-sync.js'
import { crearTiempoReal } from './sync/tiempoReal.js'

let ventana = null

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1100,
    minHeight: 680,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js')
    }
  })

  ventana = win
  win.on('closed', () => (ventana = null))

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

Menu.setApplicationMenu(null)

ipcMain.on('window:close',    () => BrowserWindow.getFocusedWindow()?.close())
ipcMain.on('window:minimize', () => BrowserWindow.getFocusedWindow()?.minimize())
ipcMain.on('window:maximize', () => {
  const win = BrowserWindow.getFocusedWindow()
  win?.isMaximized() ? win.unmaximize() : win?.maximize()
})

app.whenReady().then(() => {
  db.init()

  // Sincronizacion con la API y canal en vivo. Todo es opcional: sin servidor configurado la
  // app trabaja igual que la v1, solo con su base local.
  const enviar = (canal, datos) => ventana?.webContents.send(canal, datos)
  let vivo
  // Con WebSocket el aviso ya llega por el socket; esto cubre el sondeo, donde no hay socket.
  const sync = crearSync({
    db: db.getDb(),
    alMarcaje: (evento) => {
      if (vivo?.estado() !== 'conectado') enviar('rt:evento', evento)
    }
  })
  vivo = crearTiempoReal({
    sync,
    alEvento: (evento) => enviar('rt:evento', evento),
    alSincronizar: (resultado) => enviar('sync:cambios', resultado),
    alEstado: (estado) => enviar('rt:estado', estado)
  })
  registerIpc(ipcMain, db.getDb, { sync, vivo })
  createWindow()

  if (sync.estado().configurado && sync.estado().con_sesion) vivo.iniciar()

  // Red de seguridad: el socket avisa al instante, pero si estuvo caido esto pone todo al dia.
  const ciclo = () => {
    const s = sync.estado()
    if (!s.configurado || !s.con_sesion) return
    sync
      .sincronizar()
      .then((r) => r.bajados && enviar('sync:cambios', r))
      .catch((err) => console.warn('[sync]', err.message))
  }
  ciclo()
  setInterval(ciclo, 5 * 60_000)
})

app.on('window-all-closed', () => {
  db.cerrar()
  if (process.platform !== 'darwin') app.quit()
})
