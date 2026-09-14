export default {
  SET_EMPRESA(state, empresa) {
    state.empresa = empresa
  },
  SET_TABLA_VACACIONES(state, tabla) {
    state.tablaVacaciones = tabla || []
  }
}
