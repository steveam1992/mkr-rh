// Restringe lo que se puede teclear en un input de texto. Se usan con @keypress y
// @paste para no depender de type="number" (flechitas, notacion cientifica, etc.).

function soloCaracteres(e, permitido) {
  if (e.ctrlKey || e.metaKey || e.key.length > 1) return
  if (!permitido.test(e.key)) e.preventDefault()
}

function pegarFiltrado(e, filtro) {
  e.preventDefault()
  const el = e.target
  const texto = filtro(e.clipboardData.getData('text'))
  const ini = el.selectionStart
  const fin = el.selectionEnd
  let nuevo = el.value.slice(0, ini) + texto + el.value.slice(fin)
  if (el.maxLength > 0) nuevo = nuevo.slice(0, el.maxLength)
  el.value = nuevo
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

export default {
  methods: {
    soloEnteros(e) {
      soloCaracteres(e, /^[0-9]$/)
    },
    pegarEnteros(e) {
      pegarFiltrado(e, (t) => t.replace(/\D/g, ''))
    },
    // Digitos y un solo punto, con maximo dos decimales.
    soloDecimales(e) {
      if (e.ctrlKey || e.metaKey || e.key.length > 1) return
      if (!/^[0-9.]$/.test(e.key)) return e.preventDefault()
      const el = e.target
      const actual = el.value.slice(0, el.selectionStart) + e.key + el.value.slice(el.selectionEnd)
      if (!/^\d*\.?\d{0,2}$/.test(actual)) e.preventDefault()
    },
    pegarDecimales(e) {
      pegarFiltrado(e, (t) => {
        const limpio = t.replace(/[^\d.]/g, '')
        const [ent, ...dec] = limpio.split('.')
        return dec.length ? `${ent}.${dec.join('').slice(0, 2)}` : ent
      })
    }
  }
}
