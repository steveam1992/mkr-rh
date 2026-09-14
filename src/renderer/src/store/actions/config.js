export default {
  async cargarEmpresa({ commit }) {
    commit('SET_EMPRESA', await window.api.config.obtener())
  },
  async guardarEmpresa({ commit }, data) {
    const res = await window.api.config.guardar(data)
    if (res.ok) commit('SET_EMPRESA', res.config)
    return res
  },
  async cargarTablaVacaciones({ commit }) {
    commit('SET_TABLA_VACACIONES', await window.api.config.tablaVacaciones())
  }
}
