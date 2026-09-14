// Puente hacia el proceso principal.
//
// Vue entrega los datos de un componente (this.filtros, this.form, ...) como Proxy
// reactivo, y contextBridge no sabe pasarlos al preload: falla con "An object could not
// be cloned" y la promesa se rechaza en silencio, dejando la pantalla vacia. Tampoco se
// puede envolver window.api despues, porque contextBridge lo define como no editable.
//
// Por eso el preload expone el puente crudo como window.bridge y aqui se construye
// window.api encima, aplanando el payload de cada llamada. Asi las vistas siguen
// escribiendo window.api.empleados.listar(this.filtros) sin acordarse del detalle.
function aDatosPlanos(payload) {
  if (payload === null || payload === undefined || typeof payload !== 'object') return payload
  return JSON.parse(JSON.stringify(payload))
}

function envolver(bridge) {
  const api = {}
  for (const [dominio, acciones] of Object.entries(bridge)) {
    api[dominio] = {}
    for (const [accion, fn] of Object.entries(acciones)) {
      api[dominio][accion] = (payload) => fn(aDatosPlanos(payload))
    }
  }
  return api
}

if (!window.bridge) {
  throw new Error('El preload no expuso window.bridge: revisa src/preload/index.js')
}

const api = envolver(window.bridge)
window.api = api

export default api
