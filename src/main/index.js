import { app, BrowserWindow, Menu, ipcMain } from 'electron'
import path from 'path'
import * as db from './db'
import { registerIpc } from './ipc'

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
  registerIpc(ipcMain, db.getDb)
  createWindow()
})

app.on('window-all-closed', () => {
  db.cerrar()
  if (process.platform !== 'darwin') app.quit()
})
