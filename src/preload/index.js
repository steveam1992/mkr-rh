const { contextBridge, ipcRenderer, shell } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  openUrl: (url) => shell.openExternal(url),
  closeWindow: () => ipcRenderer.send('window:close'),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize')
})

const invoke = (channel) => (payload) => ipcRenderer.invoke(channel, payload)

// Se expone como 'bridge' y no como 'api': el renderer construye window.api encima de
// esto para aplanar los objetos reactivos de Vue. Ver src/renderer/src/utils/api.js.
contextBridge.exposeInMainWorld('bridge', {
  setup: {
    estado: invoke('setup:estado'),
    completar: invoke('setup:completar')
  },
  auth: {
    login: invoke('auth:login'),
    listarUsuarios: invoke('auth:listarUsuarios'),
    crearUsuario: invoke('auth:crearUsuario'),
    actualizarUsuario: invoke('auth:actualizarUsuario'),
    toggleActivo: invoke('auth:toggleActivo'),
    eliminarUsuario: invoke('auth:eliminarUsuario'),
    cambiarPassword: invoke('auth:cambiarPassword'),
    restablecerPassword: invoke('auth:restablecerPassword')
  },
  config: {
    obtener: invoke('config:obtener'),
    guardar: invoke('config:guardar'),
    seleccionarLogo: invoke('config:seleccionarLogo'),
    tablaVacaciones: invoke('config:tablaVacaciones'),
    guardarTablaVacaciones: invoke('config:guardarTablaVacaciones'),
    tarifaIsr: invoke('config:tarifaIsr'),
    guardarTarifaIsr: invoke('config:guardarTarifaIsr'),
    festivos: invoke('config:festivos'),
    agregarFestivo: invoke('config:agregarFestivo'),
    eliminarFestivo: invoke('config:eliminarFestivo'),
    respaldar: invoke('config:respaldar'),
    restaurar: invoke('config:restaurar'),
    abrirCarpetaDatos: invoke('config:abrirCarpetaDatos')
  },
  catalogos: {
    departamentos: invoke('catalogos:departamentos'),
    crearDepartamento: invoke('catalogos:crearDepartamento'),
    actualizarDepartamento: invoke('catalogos:actualizarDepartamento'),
    eliminarDepartamento: invoke('catalogos:eliminarDepartamento'),
    puestos: invoke('catalogos:puestos'),
    crearPuesto: invoke('catalogos:crearPuesto'),
    actualizarPuesto: invoke('catalogos:actualizarPuesto'),
    eliminarPuesto: invoke('catalogos:eliminarPuesto')
  },
  empleados: {
    listar: invoke('empleados:listar'),
    obtener: invoke('empleados:obtener'),
    crear: invoke('empleados:crear'),
    actualizar: invoke('empleados:actualizar'),
    previewFiniquito: invoke('empleados:previewFiniquito'),
    darDeBaja: invoke('empleados:darDeBaja'),
    reingresar: invoke('empleados:reingresar'),
    bajas: invoke('empleados:bajas'),
    movimientos: invoke('empleados:movimientos'),
    organigrama: invoke('empleados:organigrama'),
    seleccionarFoto: invoke('empleados:seleccionarFoto'),
    siguienteNumero: invoke('empleados:siguienteNumero')
  },
  documentos: {
    listar: invoke('documentos:listar'),
    agregar: invoke('documentos:agregar'),
    actualizar: invoke('documentos:actualizar'),
    abrir: invoke('documentos:abrir'),
    exportar: invoke('documentos:exportar'),
    eliminar: invoke('documentos:eliminar'),
    porVencer: invoke('documentos:porVencer'),
    abrirCarpeta: invoke('documentos:abrirCarpeta')
  },
  vacaciones: {
    listar: invoke('vacaciones:listar'),
    saldos: invoke('vacaciones:saldos'),
    saldo: invoke('vacaciones:saldo'),
    calcularDias: invoke('vacaciones:calcularDias'),
    crear: invoke('vacaciones:crear'),
    resolver: invoke('vacaciones:resolver'),
    eliminar: invoke('vacaciones:eliminar'),
    ajustes: invoke('vacaciones:ajustes'),
    ajustar: invoke('vacaciones:ajustar'),
    eliminarAjuste: invoke('vacaciones:eliminarAjuste'),
    enCurso: invoke('vacaciones:enCurso')
  },
  incapacidades: {
    listar: invoke('incapacidades:listar'),
    crear: invoke('incapacidades:crear'),
    actualizar: invoke('incapacidades:actualizar'),
    eliminar: invoke('incapacidades:eliminar'),
    vigentes: invoke('incapacidades:vigentes'),
    resumen: invoke('incapacidades:resumen')
  },
  permisos: {
    listar: invoke('permisos:listar'),
    crear: invoke('permisos:crear'),
    actualizar: invoke('permisos:actualizar'),
    resolver: invoke('permisos:resolver'),
    eliminar: invoke('permisos:eliminar'),
    enCurso: invoke('permisos:enCurso')
  },
  asistencia: {
    dia: invoke('asistencia:dia'),
    guardar: invoke('asistencia:guardar'),
    guardarLote: invoke('asistencia:guardarLote'),
    listar: invoke('asistencia:listar'),
    resumen: invoke('asistencia:resumen'),
    calendario: invoke('asistencia:calendario'),
    eliminar: invoke('asistencia:eliminar')
  },
  nomina: {
    periodos: invoke('nomina:periodos'),
    crearPeriodo: invoke('nomina:crearPeriodo'),
    generar: invoke('nomina:generar'),
    recibos: invoke('nomina:recibos'),
    actualizarRecibo: invoke('nomina:actualizarRecibo'),
    calcularAguinaldo: invoke('nomina:calcularAguinaldo'),
    aplicarAguinaldo: invoke('nomina:aplicarAguinaldo'),
    cerrarPeriodo: invoke('nomina:cerrarPeriodo'),
    reabrirPeriodo: invoke('nomina:reabrirPeriodo'),
    eliminarPeriodo: invoke('nomina:eliminarPeriodo'),
    imprimirRecibo: invoke('nomina:imprimirRecibo')
  },
  dashboard: {
    resumen: invoke('dashboard:resumen'),
    ausenciasHoy: invoke('dashboard:ausenciasHoy'),
    celebraciones: invoke('dashboard:celebraciones'),
    alertas: invoke('dashboard:alertas'),
    movimientoPlantilla: invoke('dashboard:movimientoPlantilla')
  },
  reportes: {
    disponibles: invoke('reportes:disponibles'),
    previsualizar: invoke('reportes:previsualizar'),
    exportar: invoke('reportes:exportar')
  }
})
