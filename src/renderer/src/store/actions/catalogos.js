export default {
  async cargarCatalogos({ commit }) {
    const [departamentos, puestos] = await Promise.all([
      window.api.catalogos.departamentos(),
      window.api.catalogos.puestos()
    ])
    commit('SET_DEPARTAMENTOS', departamentos)
    commit('SET_PUESTOS', puestos)
  }
}
