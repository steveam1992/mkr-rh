<template>
  <div class="page">
    <div class="page__head">
      <div>
        <div class="page__title">Reportes</div>
        <div class="page__subtitle">Vista previa en pantalla y exportación a Excel</div>
      </div>
      <div class="page__acciones">
        <button class="btn-primary" :disabled="!seleccionado || exportando" @click="exportar">
          {{ exportando ? 'Guardando...' : 'Exportar a Excel' }}
        </button>
      </div>
    </div>

    <div class="cuerpo">
      <aside class="lista">
        <div
          v-for="r in disponibles"
          :key="r.clave"
          class="reporte"
          :class="{ 'reporte--activo': seleccionado?.clave === r.clave }"
          @click="seleccionar(r)"
        >
          <div class="reporte__nombre">{{ r.nombre }}</div>
          <div class="muted">{{ r.descripcion }}</div>
        </div>
      </aside>

      <section class="vista" v-if="seleccionado">
        <div class="toolbar">
          <template v-if="seleccionado.rango">
            <input type="date" v-model="params.desde" @change="previsualizar" />
            <input type="date" v-model="params.hasta" @change="previsualizar" />
          </template>
          <select v-if="seleccionado.periodo" v-model.number="params.periodo_id" @change="previsualizar">
            <option :value="null">Selecciona un periodo…</option>
            <option v-for="p in periodos" :key="p.id" :value="p.id">{{ p.nombre }}</option>
          </select>
          <span class="muted" v-if="total">{{ total }} registro(s)</span>
        </div>

        <div class="table-scroll" v-if="filas.length">
          <table class="data-table">
            <thead>
              <tr><th v-for="c in columnas" :key="c">{{ c }}</th></tr>
            </thead>
            <tbody>
              <tr v-for="(f, i) in filas" :key="i">
                <td v-for="c in columnas" :key="c" :class="{ num: esNumero(f[c]) }">{{ celda(f[c]) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="empty" v-else>{{ mensaje || 'Sin registros para mostrar' }}</p>
        <p class="muted" v-if="total > filas.length">
          Se muestran los primeros {{ filas.length }}; el archivo exportado trae los {{ total }}.
        </p>
      </section>

      <section class="vista" v-else>
        <p class="empty">Elige un reporte de la izquierda</p>
      </section>
    </div>
  </div>
</template>

<script>
import formats from '../mixin/formats'

export default {
  name: 'Reportes',
  mixins: [formats],
  data() {
    return {
      disponibles: [],
      periodos: [],
      seleccionado: null,
      params: { desde: '', hasta: '', periodo_id: null },
      filas: [],
      columnas: [],
      total: 0,
      mensaje: '',
      exportando: false
    }
  },
  async mounted() {
    const f = new Date()
    this.params.desde = `${f.getFullYear()}-01-01`
    this.params.hasta = this.hoyIso()
    this.disponibles = await window.api.reportes.disponibles()
    this.periodos = await window.api.nomina.periodos()
  },
  methods: {
    async seleccionar(r) {
      this.seleccionado = r
      await this.previsualizar()
    },
    async previsualizar() {
      this.mensaje = ''
      this.filas = []
      this.columnas = []
      this.total = 0

      if (this.seleccionado.periodo && !this.params.periodo_id) {
        this.mensaje = 'Selecciona el periodo de nómina'
        return
      }

      const res = await window.api.reportes.previsualizar({
        tipo: this.seleccionado.clave,
        params: this.params
      })
      if (!res.ok) {
        this.mensaje = res.mensaje
        return
      }
      this.filas = res.filas
      this.total = res.total
      this.columnas = res.filas.length ? Object.keys(res.filas[0]) : []
    },
    async exportar() {
      this.exportando = true
      try {
        const res = await window.api.reportes.exportar({
          tipo: this.seleccionado.clave,
          params: this.params
        })
        if (res.canceled) return
        if (!res.ok) {
          this.$store.dispatch('notificar', { mensaje: res.mensaje, tipo: 'error' })
          return
        }
        this.$store.dispatch('notificar', { mensaje: `${res.registros} registro(s) exportados` })
      } finally {
        this.exportando = false
      }
    },
    esNumero(valor) {
      return typeof valor === 'number'
    },
    celda(valor) {
      if (valor === null || valor === undefined || valor === '') return '—'
      if (typeof valor === 'number' && !Number.isInteger(valor)) return valor.toFixed(2)
      return valor
    }
  }
}
</script>

<style scoped>
.cuerpo {
  flex: 1;
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 16px;
  min-height: 0;
}

.lista {
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding-right: 4px;
}

.reporte {
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 11px 13px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.reporte:hover {
  border-color: var(--primary-light);
}

.reporte--activo {
  border-color: var(--primary);
  background: var(--primary-soft);
}

.reporte__nombre {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-1);
  margin-bottom: 2px;
}

.vista {
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: 12px;
}
</style>
