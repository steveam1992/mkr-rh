const JERARQUIA = { admin: 4, rh: 3, supervisor: 2, consulta: 1 }

export default {
  isAuthenticated: (state) => !!state.usuario,
  usuarioActual: (state) => state.usuario,
  esAdmin: (state) => state.usuario?.rol === 'admin',
  // Consulta solo lee; supervisor captura incidencias; rh y admin operan todo.
  puedeEditar: (state) => JERARQUIA[state.usuario?.rol] >= 2,
  puedeAdministrar: (state) => JERARQUIA[state.usuario?.rol] >= 3
}
