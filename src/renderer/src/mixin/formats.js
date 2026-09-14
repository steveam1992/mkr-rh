const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export default {
  methods: {
    formatMoney(monto) {
      return Number(monto || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
    },
    formatFecha(iso) {
      if (!iso) return '—'
      const [y, m, d] = String(iso).slice(0, 10).split('-')
      return `${Number(d)} ${MESES[Number(m) - 1]} ${y}`
    },
    formatFechaCorta(iso) {
      if (!iso) return '—'
      const [y, m, d] = String(iso).slice(0, 10).split('-')
      return `${d}/${m}/${y}`
    },
    formatDias(n) {
      const v = Number(n || 0)
      return `${v} ${v === 1 ? 'día' : 'días'}`
    },
    hoyIso() {
      const f = new Date()
      return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
    },
    iniciales(nombre) {
      return String(nombre || '')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0].toUpperCase())
        .join('')
    }
  }
}
