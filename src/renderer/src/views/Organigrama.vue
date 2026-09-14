<template>
  <div class="page">
    <div class="page__head">
      <div>
        <div class="page__title">Organigrama</div>
        <div class="page__subtitle">
          Se arma con el jefe directo de cada empleado. Asígnalo en su expediente.
        </div>
      </div>
    </div>

    <div class="lienzo">
      <div class="nivel" v-if="raices.length">
        <NodoOrganigrama v-for="n in raices" :key="n.id" :nodo="n" @abrir="abrir" />
      </div>
      <p class="empty" v-else>Aún no hay empleados activos.</p>
    </div>
  </div>
</template>

<script>
import { h, defineComponent } from 'vue'

// Nodo recursivo: cada empleado dibuja su tarjeta y debajo la rama de sus subordinados.
const NodoOrganigrama = defineComponent({
  name: 'NodoOrganigrama',
  props: { nodo: { type: Object, required: true } },
  emits: ['abrir'],
  render() {
    const iniciales = String(this.nodo.nombre_completo || '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('')

    const tarjeta = h('div', { class: 'nodo__tarjeta', onClick: () => this.$emit('abrir', this.nodo) }, [
      h('div', { class: 'nodo__avatar' }, this.nodo.foto
        ? [h('img', { src: this.nodo.foto, alt: '' })]
        : [iniciales]),
      h('div', { class: 'nodo__datos' }, [
        h('div', { class: 'nodo__nombre' }, this.nodo.nombre_completo),
        h('div', { class: 'nodo__puesto' }, this.nodo.puesto || 'Sin puesto'),
        this.nodo.departamento ? h('div', { class: 'nodo__depto' }, this.nodo.departamento) : null
      ])
    ])

    const hijos = this.nodo.hijos?.length
      ? h('div', { class: 'nodo__hijos' }, this.nodo.hijos.map((hijo) =>
          h(NodoOrganigrama, { nodo: hijo, key: hijo.id, onAbrir: (n) => this.$emit('abrir', n) })
        ))
      : null

    return h('div', { class: 'nodo' }, [tarjeta, hijos])
  }
})

export default {
  name: 'Organigrama',
  components: { NodoOrganigrama },
  data() {
    return { raices: [] }
  },
  async mounted() {
    this.raices = await window.api.empleados.organigrama()
  },
  methods: {
    abrir(nodo) {
      this.$router.push(`/empleados/${nodo.id}`)
    }
  }
}
</script>

<style>
/* Sin scoped: las clases las generan los nodos recursivos con render(). */
.lienzo {
  flex: 1;
  overflow: auto;
  min-height: 0;
  padding: 10px 4px 24px;
}

.nivel {
  display: flex;
  gap: 28px;
  align-items: flex-start;
  justify-content: center;
  min-width: min-content;
}

.nodo {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.nodo__tarjeta {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: 14px;
  padding: 10px 14px 10px 10px;
  min-width: 200px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.nodo__tarjeta:hover {
  border-color: var(--primary);
  box-shadow: 0 4px 16px rgba(108, 92, 231, 0.16);
}

.nodo__avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--primary-soft);
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 800;
  overflow: hidden;
  flex-shrink: 0;
}

.nodo__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.nodo__nombre {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-1);
  white-space: nowrap;
}

.nodo__puesto {
  font-size: 11.5px;
  color: var(--text-2);
  white-space: nowrap;
}

.nodo__depto {
  font-size: 10.5px;
  color: var(--text-3);
  white-space: nowrap;
}

.nodo__hijos {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  margin-top: 26px;
  position: relative;
}

/* Conector vertical del padre hacia la rama de hijos. */
.nodo__hijos::before {
  content: '';
  position: absolute;
  top: -26px;
  left: 50%;
  width: 1.5px;
  height: 13px;
  background: var(--border);
}

.nodo__hijos > .nodo::before {
  content: '';
  position: absolute;
  top: -13px;
  left: 50%;
  width: 1.5px;
  height: 13px;
  background: var(--border);
}

/* Barra horizontal que une a los hermanos. */
.nodo__hijos > .nodo:not(:only-child)::after {
  content: '';
  position: absolute;
  top: -13px;
  height: 1.5px;
  background: var(--border);
  width: calc(50% + 10px);
}

.nodo__hijos > .nodo:not(:only-child):first-child::after {
  left: 50%;
}

.nodo__hijos > .nodo:not(:only-child):last-child::after {
  right: 50%;
}

.nodo__hijos > .nodo:not(:only-child):not(:first-child):not(:last-child)::after {
  left: -10px;
  width: calc(100% + 20px);
}
</style>
