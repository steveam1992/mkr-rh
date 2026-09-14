import * as setup from './setup'
import * as auth from './auth'
import * as config from './config'
import * as catalogos from './catalogos'
import * as empleados from './empleados'
import * as documentos from './documentos'
import * as conceptos from './conceptos'
import * as vacaciones from './vacaciones'
import * as incapacidades from './incapacidades'
import * as permisos from './permisos'
import * as asistencia from './asistencia'
import * as nomina from './nomina'
import * as dashboard from './dashboard'
import * as reportes from './reportes'

export function registerIpc(ipcMain, getDb) {
  setup.register(ipcMain, getDb)
  auth.register(ipcMain, getDb)
  config.register(ipcMain, getDb)
  catalogos.register(ipcMain, getDb)
  empleados.register(ipcMain, getDb)
  documentos.register(ipcMain, getDb)
  conceptos.register(ipcMain, getDb)
  vacaciones.register(ipcMain, getDb)
  incapacidades.register(ipcMain, getDb)
  permisos.register(ipcMain, getDb)
  asistencia.register(ipcMain, getDb)
  nomina.register(ipcMain, getDb)
  dashboard.register(ipcMain, getDb)
  reportes.register(ipcMain, getDb)
}
