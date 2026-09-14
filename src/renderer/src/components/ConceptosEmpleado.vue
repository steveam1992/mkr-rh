<template>
  <div class="panel">
    <div class="toolbar">
      <button class="btn-primary" @click="abrir()">+ Agregar concepto</button>
      <label class="checkbox">
        <input type="checkbox" v-model="incluirInactivos" @change="cargar" />
        Ver también los inactivos
      </label>
      <span class="muted">
        Entran solos a cada nómina; no hay que recapturarlos periodo a periodo.
      </span>
    </div>

    <section class="card" v-for="grupo in grupos" :key="grupo.tipo">
      <div class="card__titulo">{{ grupo.titulo }}</div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Concepto</th>
            <th>Importe por periodo</th>
            <th>Vigencia</th>
            <th class="num">Crédito</th>
            <th class="num">Saldo</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in grupo.filas" :key="c.id" :class="{ inactivo: !c.activo }">
            <td>
              <div class="principal">
                {{ ETIQUETA[c.clave] || c.clave }}
                <span class="badge badge--rojo" v-if="!c.activo">Inactivo</span>
                <span class="badge badge--verde" v-else-if="c.liquidado">Liquidado</span>
                <span class="badge" v-if="c.tipo === 'percepcion' && !c.gravable">Exento de ISR</span>
              </div>
              <div class="muted" v-if="c.descripcion">{{ c.descripcion }}</div>
              <div class="muted" v-if="c.numero_credito">Crédito {{ c.numero_credito }}</div>
            </td>
            <td>
              <b v-if="c.calculo === 'fijo'">{{ formatMoney(c.monto) }}</b>
              <b v-else>{{ c.monto }}% del sueldo</b>
            </td>
            <td class="muted">
              <span v-if="!c.fecha_inicio && !c.fecha_fin">Sin límite</span>
              <span v-else>
                {{ c.fecha_inicio ? formatFechaCorta(c.fecha_inicio) : '…' }} —
                {{ c.fecha_fin ? formatFechaCorta(c.fecha_fin) : '…' }}
              </span>
            </td>
            <td class="num">{{ c.total_credito > 0 ? formatMoney(c.total_credito) : '—' }}</td>
            <td class="num">
              <template v-if="c.saldo !== null">
                <b :style="{ color: c.liquidado ? 'var(--green)' : 'var(--text-1)' }">
                  {{ formatMoney(c.saldo) }}
                </b>
                <div class="barra">
                  <div class="barra__fill" :style="{ width: avance(c) }"></div>
                </div>
                <div class="muted">{{ formatMoney(c.aplicado) }} pagado</div>
              </template>
              <span v-else class="muted">—</span>
            </td>
            <td>
              <div class="acciones">
                <button class="icon-btn" title="Ver descuentos aplicados" v-if="c.total_credito > 0" @click="verHistorial(c)">≡</button>
                <button class="icon-btn" title="Editar" @click="abrir(c)">✎</button>
                <button class="btn-ghost btn-sm" @click="toggle(c)">
                  {{ c.activo ? 'Desactivar' : 'Activar' }}
                </button>
                <button class="icon-btn icon-btn--danger" title="Eliminar" @click="eliminar(c)">✕</button>
              </div>
            </td>
          </tr>
          <tr v-if="grupo.filas.length === 0">
            <td colspan="6" class="empty">{{ grupo.vacio }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Alta / edición -->
    <div class="modal-backdrop" v-if="form" @click.self="form = null">
      <div class="modal">
        <div class="modal__titulo">{{ form.id ? 'Editar concepto' : 'Agregar concepto' }}</div>
        <div class="modal__sub">
          Se aplicará en cada nómina mientras esté activo y dentro de su vigencia.
        </div>

        <div class="campo">
          <label>Tipo de concepto</label>
          <select v-model="form.clave" @change="alCambiarClave">
            <optgroup label="Percepciones">
              <option v-for="c in CLAVES_PERCEPCION" :key="c" :value="c">{{ ETIQUETA[c] }}</option>
            </optgroup>
            <optgroup label="Deducciones">
              <option v-for="c in CLAVES_DEDUCCION" :key="c" :value="c">{{ ETIQUETA[c] }}</option>
            </optgroup>
          </select>
        </div>

        <div class="campo">
          <label>Descripción (opcional)</label>
          <input type="text" v-model="form.descripcion" :placeholder="ETIQUETA[form.clave]" />
        </div>

        <div class="campos">
          <div class="campo">
            <label>Cómo se calcula</label>
            <select v-model="form.calculo">
              <option value="fijo">Importe fijo por periodo</option>
              <option value="porcentaje">Porcentaje del sueldo</option>
            </select>
          </div>
          <div class="campo">
            <label>{{ form.calculo === 'fijo' ? 'Importe por periodo' : 'Porcentaje' }}</label>
            <input type="number" min="0" step="0.01" v-model.number="form.monto" />
          </div>
        </div>

        <template v-if="esCredito">
          <div class="campos">
            <div class="campo">
              <label>Número de crédito</label>
              <input type="text" v-model="form.numero_credito" />
            </div>
            <div class="campo">
              <label>Monto total del crédito</label>
              <input type="number" min="0" step="0.01" v-model.number="form.total_credito" />
            </div>
          </div>
          <p class="nota">
            Con el monto total capturado, el sistema va amortizando y deja de descontar
            al liquidarse; el último descuento es el remanente exacto. Déjalo en 0 si es
            un descuento fijo sin fecha de término.
          </p>
        </template>

        <div class="campos">
          <div class="campo">
            <label>Desde (opcional)</label>
            <input type="date" v-model="form.fecha_inicio" />
          </div>
          <div class="campo">
            <label>Hasta (opcional)</label>
            <input type="date" v-model="form.fecha_fin" />
          </div>
        </div>

        <div class="campo" v-if="esPercepcion">
          <label class="checkbox">
            <input type="checkbox" v-model="form.gravable" />
            Grava para ISR
          </label>
          <p class="muted">
            Desmárcalo en prestaciones exentas como los vales de despensa: se excluyen de
            la base gravable pero sí se pagan.
          </p>
        </div>

        <div class="campo">
          <label>Notas</label>
          <input type="text" v-model="form.notas" />
        </div>

        <p class="error" v-if="error">{{ error }}</p>

        <div class="modal__acciones">
          <button class="btn-ghost" @click="form = null">Cancelar</button>
          <button class="btn-primary" @click="guardar">Guardar</button>
        </div>
      </div>
    </div>

    <!-- Historial del crédito -->
    <div class="modal-backdrop" v-if="historial" @click.self="historial = null">
      <div class="modal">
        <div class="modal__titulo">{{ ETIQUETA[historial.concepto.clave] }}</div>
        <div class="modal__sub">
          {{ historial.concepto.numero_credito || 'Sin número de crédito' }} ·
          {{ formatMoney(historial.concepto.aplicado) }} de {{ formatMoney(historial.concepto.total_credito) }}
        </div>

        <table class="data-table">
          <thead><tr><th>Periodo</th><th>Fechas</th><th class="num">Descuento</th></tr></thead>
          <tbody>
            <tr v-for="a in historial.filas" :key="a.id">
              <td class="principal">{{ a.periodo }}</td>
              <td class="muted">{{ formatFechaCorta(a.fecha_inicio) }} — {{ formatFechaCorta(a.fecha_fin) }}</td>
              <td class="num">{{ formatMoney(a.importe) }}</td>
            </tr>
            <tr v-if="historial.filas.length === 0">
              <td colspan="3" class="empty">Todavía no se ha descontado en ninguna nómina</td>
            </tr>
          </tbody>
        </table>

        <div class="modal__acciones">
          <button class="btn-ghost" @click="historial = null">Cerrar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import formats from '../mixin/formats'

const ETIQUETA = {
  bono: 'Bono',
  puntualidad: 'Bono de puntualidad',
  asistencia: 'Bono de asistencia',
  productividad: 'Bono de productividad',
  comision: 'Comisiones',
  despensa: 'Vales de despensa',
  transporte: 'Ayuda de transporte',
  otra_percepcion: 'Otra percepción',
  infonavit: 'INFONAVIT',
  fonacot: 'FONACOT',
  prestamo: 'Préstamo de la empresa',
  caja_ahorro: 'Caja de ahorro',
  pension_alimenticia: 'Pensión alimenticia',
  sindicato: 'Cuota sindical',
  otra_deduccion: 'Otra deducción'
}

const CLAVES_PERCEPCION = ['bono', 'puntualidad', 'asistencia', 'productividad', 'comision', 'despensa', 'transporte', 'otra_percepcion']
const CLAVES_DEDUCCION = ['infonavit', 'fonacot', 'prestamo', 'caja_ahorro', 'pension_alimenticia', 'sindicato', 'otra_deduccion']
const CON_CREDITO = ['infonavit', 'fonacot', 'prestamo']
// Prestaciones que normalmente se capturan exentas.
const EXENTAS_POR_DEFECTO = ['despensa', 'transporte']

export default {
  name: 'ConceptosEmpleado',
  mixins: [formats],
  props: { empleadoId: { type: [String, Number], required: true } },
  emits: ['cambio'],
  data() {
    return {
      ETIQUETA,
      CLAVES_PERCEPCION,
      CLAVES_DEDUCCION,
      conceptos: [],
      incluirInactivos: false,
      form: null,
      error: '',
      historial: null
    }
  },
  computed: {
    ...mapGetters(['usuarioActual']),
    grupos() {
      return [
        {
          tipo: 'percepcion',
          titulo: 'Percepciones fijas',
          vacio: 'Sin bonos ni prestaciones registradas',
          filas: this.conceptos.filter((c) => c.tipo === 'percepcion')
        },
        {
          tipo: 'deduccion',
          titulo: 'Deducciones y créditos',
          vacio: 'Sin FONACOT, INFONAVIT ni otros descuentos registrados',
          filas: this.conceptos.filter((c) => c.tipo === 'deduccion')
        }
      ]
    },
    esCredito() {
      return CON_CREDITO.includes(this.form?.clave)
    },
    esPercepcion() {
      return CLAVES_PERCEPCION.includes(this.form?.clave)
    }
  },
  mounted() {
    this.cargar()
  },
  methods: {
    async cargar() {
      this.conceptos = await window.api.conceptos.listar({
        empleado_id: Number(this.empleadoId),
        incluirInactivos: this.incluirInactivos
      })
    },
    avance(c) {
      if (!c.total_credito) return '0%'
      return `${Math.min(100, Math.round((c.aplicado / c.total_credito) * 100))}%`
    },
    abrir(concepto = null) {
      this.error = ''
      this.form = concepto
        ? { ...concepto }
        : {
            clave: 'bono',
            descripcion: '',
            calculo: 'fijo',
            monto: 0,
            gravable: true,
            numero_credito: '',
            total_credito: 0,
            fecha_inicio: '',
            fecha_fin: '',
            notas: ''
          }
    },
    alCambiarClave() {
      if (this.form.id) return
      this.form.gravable = !EXENTAS_POR_DEFECTO.includes(this.form.clave)
      if (!CON_CREDITO.includes(this.form.clave)) {
        this.form.numero_credito = ''
        this.form.total_credito = 0
      }
    },
    async guardar() {
      this.error = ''
      const data = {
        ...this.form,
        empleado_id: Number(this.empleadoId),
        usuario_id: this.usuarioActual?.id
      }
      const res = this.form.id
        ? await window.api.conceptos.actualizar({ id: this.form.id, data })
        : await window.api.conceptos.crear(data)

      if (!res.ok) {
        this.error = res.mensaje
        return
      }
      this.form = null
      await this.cargar()
      this.$emit('cambio')
      this.$store.dispatch('notificar', { mensaje: 'Concepto guardado' })
    },
    async toggle(c) {
      await window.api.conceptos.toggleActivo({ id: c.id, activo: !c.activo })
      await this.cargar()
      this.$emit('cambio')
    },
    async eliminar(c) {
      if (!confirm(`¿Eliminar "${ETIQUETA[c.clave]}"?`)) return
      const res = await window.api.conceptos.eliminar(c.id)
      if (!res.ok) {
        this.$store.dispatch('notificar', { mensaje: res.mensaje, tipo: 'error' })
        return
      }
      await this.cargar()
      this.$emit('cambio')
    },
    async verHistorial(c) {
      this.historial = { concepto: c, filas: await window.api.conceptos.aplicaciones(c.id) }
    }
  }
}
</script>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.inactivo {
  opacity: 0.55;
}

.principal {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}

.barra {
  height: 5px;
  border-radius: 4px;
  background: var(--surface-2);
  overflow: hidden;
  margin: 4px 0 2px;
}

.barra__fill {
  height: 100%;
  border-radius: 4px;
  background: var(--primary);
}
</style>
