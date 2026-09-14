export default {
  async cargarEstadoSetup({ commit }) {
    try {
      const res = await window.api.setup.estado()
      commit('SET_REQUIERE_SETUP', !!res?.requiereSetup)
      return res
    } catch (e) {
      // Si no se puede consultar, seguimos al login en lugar de dejar la ventana en blanco.
      console.error('No se pudo consultar el estado de la configuración inicial', e)
      commit('SET_REQUIERE_SETUP', false)
      return { requiereSetup: false }
    }
  },
  async completarSetup({ commit, dispatch }, data) {
    const res = await window.api.setup.completar(data)
    if (res.ok) {
      commit('SET_REQUIERE_SETUP', false)
      commit('SET_EMPRESA', res.config)
      commit('SET_USUARIO', res.usuario)
      // El setup deja la sesion iniciada sin pasar por el login, que es donde se
      // cargaban los catalogos: sin esto los desplegables salen vacios.
      await dispatch('cargarCatalogos')
    }
    return res
  }
}
