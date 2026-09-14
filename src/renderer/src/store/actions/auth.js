export default {
  async login({ commit, dispatch }, { usuario, password }) {
    const res = await window.api.auth.login({ usuario, password })
    if (res.ok) {
      commit('SET_USUARIO', res.usuario)
      await dispatch('cargarCatalogos')
    }
    return res
  },
  logout({ commit }) {
    commit('SET_USUARIO', null)
  }
}
