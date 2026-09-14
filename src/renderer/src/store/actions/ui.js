let temporizador = null

export default {
  // Aviso breve en la esquina; se reemplaza si llega otro antes de expirar.
  notificar({ commit }, { mensaje, tipo = 'exito', duracion = 3500 }) {
    clearTimeout(temporizador)
    commit('SET_NOTIFICACION', { mensaje, tipo })
    temporizador = setTimeout(() => commit('SET_NOTIFICACION', null), duracion)
  },
  cerrarNotificacion({ commit }) {
    clearTimeout(temporizador)
    commit('SET_NOTIFICACION', null)
  }
}
