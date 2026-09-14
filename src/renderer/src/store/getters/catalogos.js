export default {
  departamentos: (state) => state.departamentos,
  puestos: (state) => state.puestos,
  puestosDe: (state) => (departamentoId) =>
    departamentoId ? state.puestos.filter((p) => p.departamento_id === departamentoId) : state.puestos
}
