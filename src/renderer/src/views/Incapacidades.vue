<template>
  <div class="page">
    <div class="page__head">
      <div>
        <div class="page__title">Incapacidades</div>
        <div class="page__subtitle">Ausencias por enfermedad, riesgo de trabajo o maternidad</div>
      </div>
      <div class="page__acciones">
        <button class="btn-primary" @click="abrir()">+ Registrar incapacidad</button>
      </div>
    </div>

    <div class="resumen" v-if="resumen.length">
      <div class="tarjeta" v-for="r in resumen" :key="r.tipo">
        <div class="tarjeta__valor">{{ r.dias }}</div>
        <div class="tarjeta__label">días · {{ ETIQUETA[r.tipo] || r.tipo }}</div>
        <div class="muted">{{ r.casos }} caso(s) · {{ r.empleados }} empleado(s)</div>
      </div>
    </div>

    <div class="toolbar">
      <select v-model="filtros.tipo" @change="cargar">
        <option value="todos">Todos los tipos</option>
        <option v-for="(label, clave) in ETIQUETA" :key="clave" :value="clave">{{ label }}</option>
      </select>
      <input type="date" v-model="filtros.desde" @change="cargar" />
      <input type="date" v-model="filtros.hasta" @change="cargar" />
      <button class="btn-ghost btn-sm" @click="limpiar">Limpiar</button>
    </div>

    <div class="table-scroll">
      <table class="data-table">
        <thead>
          <tr>
            <th>Empleado</th>
            <th>Folio</th>
            <th>Tipo</th>
            <th>Control</th>
            <th>Periodo</th>
            <th class="num">Días</th>
            <th class="num">% pago</th>
            <th class="num">Subsidio est.</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="i in lista" :key="i.id">
            <td>
              <div class="principal clickable" @click="$router.push(`/empleados/${i.empleado_id}`)">{{ i.empleado }}</div>
              <div class="muted">NSS {{ i.nss || '—' }}</div>
            </td>
            <td>{{ i.folio || '—' }}</td>
            <td><span :class="['badge', badgeTipo(i.tipo)]">{{ ETIQUETA[i.tipo] || i.tipo }}</span></td>
            <td>{{ ETIQUETA_CONTROL[i.control] || i.control }}</td>
            <td>
              {{ formatFechaCorta(i.fecha_inicio) }} — {{ formatFechaCorta(i.fecha_fin) }}
              <span class="badge badge--rojo" v-if="i.vigente">Vigente</span>
            </td>
            <td class="num">{{ i.dias }}</td>
            <td class="num">{{ i.porcentaje_pago }}%</td>
            <td class="num">{{ formatMoney(i.subsidio_estimado) }}</td>
            <td>
              <div class="acciones">
                <button class="icon-btn" title="Editar" @click="abrir(i)">✎</button>
                <button class="icon-btn icon-btn--danger" title="Eliminar" @click="eliminar(i)">✕</button>
              </div>
            </td>
          </tr>
          <tr v-if="lista.length === 0">
            <td colspan="9" class="empty">Sin incapacidades registradas con esos filtros</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="modal-backdrop" v-if="form" @click.self="form = null">
      <div class="modal">
        <div class="modal__titulo">{{ form.id ? 'Editar incapacidad' : 'Registrar incapacidad' }}</div>
        <div class="modal__sub">
          El porcentaje se propone según el ramo: 60% en enfermedad general y 100% en
          riesgo de trabajo y maternidad. Se puede cambiar.
        </div>

        <div class="campo">
          <label>Empleado</label>
          <select v-model.number="form.empleado_id" :disabled="!!form.id">
            <option :value="null">Selecciona…</option>
            <option v-for="e in empleados" :key="e.id" :value="e.id">{{ e.nombre_completo }}</option>
          </select>
        </div>

        <div class="campos">
          <div class="campo">
            <label>Tipo</label>
            <select v-model="form.tipo" @change="aplicarPorcentaje">
              <option v-for="(label, clave) in ETIQUETA" :key="clave" :value="clave">{{ label }}</option>
            </select>
          </div>
          <div class="campo">
            <label>Control</label>
            <select v-model="form.control">
              <option v-for="(label, clave) in ETIQUETA_CONTROL" :key="clave" :value="clave">{{ label }}</option>
            </select>
          </div>
          <div class="campo">
            <label>Folio</label>
            <input type="text" v-model="form.folio" />
          </div>
        </div>

        <div class="campos">
          <div class="campo">
            <label>Del</label>
            <input type="date" v-model="form.fecha_inicio" @change="calcularDias" />
          </div>
          <div class="campo">
            <label>Al</label>
            <input type="date" v-model="form.fecha_fin" @change="calcularDias" />
          </div>
          <div class="campo">
            <label>Días</label>
            <input type="number" min="0" v-model.number="form.dias" />
          </div>
          <div class="campo">
            <label>% de pago</label>
            <input type="number" min="0" max="100" v-model.number="form.porcentaje_pago" />
          </div>
        </div>

        <div class="campo">
          <label>Notas</label>
          <textarea v-model="form.notas"></textarea>
        </div>

        <p class="nota">
          El documento del IMSS se adjunta en el expediente del empleado, pestaña Documentos.
        </p>

        <p class="error" v-if="error">{{ error }}</p>

        <div class="modal__acciones">
          <button class="btn-ghost" @click="form = null">Cancelar</button>
          <button class="btn-primary" @click="guardar">Guardar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import formats from '../mixin/formats'

const ETIQUETA = {
  enfermedad_general: 'Enfermedad general',
  riesgo_trabajo: 'Riesgo de trabajo',
  maternidad: 'Maternidad',
  pat: 'Cuidado de hijos (PAT)'
}

const ETIQUETA_CONTROL = {
  inicial: 'Inicial',
  subsecuente: 'Subsecuente',
  recaida: 'Recaída',
  alta: 'Alta'
}

const PORCENTAJE = {
  enfermedad_general: 60,
  riesgo_trabajo: 100,
  maternidad: 100,
  pat: 100
}

export default {
  name: 'Incapacidades',
  mixins: [formats],
  data() {
    return {
      ETIQUETA,
      ETIQUETA_CONTROL,
      lista: [],
      resumen: [],
      empleados: [],
      filtros: { tipo: 'todos', desde: '', hasta: '' },
      form: null,
      error: ''
    }
  },
  computed: {
    ...mapGetters(['usuarioActual'])
  },
  async mounted() {
    await this.cargar()
    this.empleados = await window.api.empleados.listar({ estatus: 'activo' })
  },
  methods: {
    async cargar() {
      const [lista, resumen] = await Promise.all([
        window.api.incapacidades.listar(this.filtros),
        window.api.incapacidades.resumen({})
      ])
      this.lista = lista
      this.resumen = resumen
    },
    limpiar() {
      this.filtros = { tipo: 'todos', desde: '', hasta: '' }
      this.cargar()
    },
    badgeTipo(tipo) {
      return {
        enfermedad_general: 'badge--azul',
        riesgo_trabajo: 'badge--rojo',
        maternidad: 'badge--morado',
        pat: 'badge--verde'
      }[tipo] || ''
    },
    abrir(incapacidad = null) {
      this.error = ''
      this.form = incapacidad
        ? { ...incapacidad }
        : {
            empleado_id: null,
            tipo: 'enfermedad_general',
            control: 'inicial',
            folio: '',
            fecha_inicio: this.hoyIso(),
            fecha_fin: this.hoyIso(),
            dias: 1,
            porcentaje_pago: 60,
            notas: ''
          }
    },
    aplicarPorcentaje() {
      this.form.porcentaje_pago = PORCENTAJE[this.form.tipo] ?? 60
    },
    calcularDias() {
      const { fecha_inicio: a, fecha_fin: b } = this.form
      if (!a || !b || b < a) return
      const dias = Math.round((new Date(b) - new Date(a)) / 86400000) + 1
      this.form.dias = dias
    },
    async guardar() {
      this.error = ''
      const data = { ...this.form, usuario_id: this.usuarioActual?.id }
      const res = this.form.id
        ? await window.api.incapacidades.actualizar({ id: this.form.id, data })
        : await window.api.incapacidades.crear(data)

      if (!res.ok) {
        this.error = res.mensaje
        return
      }
      this.form = null
      this.$store.dispatch('notificar', { mensaje: 'Incapacidad guardada' })
      await this.cargar()
    },
    async eliminar(i) {
      if (!confirm(`¿Eliminar la incapacidad de ${i.empleado}?`)) return
      await window.api.incapacidades.eliminar(i.id)
      await this.cargar()
    }
  }
}
</script>

<style scoped>
.resumen {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 10px;
  flex-shrink: 0;
}

.tarjeta {
  background: var(--surface-2);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
}

.tarjeta__valor {
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.5px;
}

.tarjeta__label {
  font-size: 12px;
  color: var(--text-2);
}
</style>
