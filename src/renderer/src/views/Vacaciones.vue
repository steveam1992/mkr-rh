<template>
  <div class="page">
    <div class="page__head">
      <div>
        <div class="page__title">Vacaciones</div>
        <div class="page__subtitle">
          Días calculados con la tabla del artículo 76 de la LFT, editable en Ajustes.
        </div>
      </div>
      <div class="page__acciones">
        <button class="btn-primary" @click="abrirNueva">+ Registrar vacaciones</button>
      </div>
    </div>

    <div class="tabs">
      <button class="tab" :class="{ 'tab--activa': tab === 'solicitudes' }" @click="tab = 'solicitudes'">
        Solicitudes<span class="conteo" v-if="pendientes">{{ pendientes }}</span>
      </button>
      <button class="tab" :class="{ 'tab--activa': tab === 'saldos' }" @click="cambiarASaldos">Saldos por empleado</button>
    </div>

    <template v-if="tab === 'solicitudes'">
      <div class="toolbar">
        <select v-model="filtros.estatus" @change="cargar">
          <option value="todos">Todos los estatus</option>
          <option value="pendiente">Pendientes</option>
          <option value="aprobada">Aprobadas</option>
          <option value="disfrutada">Disfrutadas</option>
          <option value="rechazada">Rechazadas</option>
          <option value="cancelada">Canceladas</option>
        </select>
        <select v-model.number="filtros.departamento_id" @change="cargar">
          <option :value="null">Todos los departamentos</option>
          <option v-for="d in departamentos" :key="d.id" :value="d.id">{{ d.nombre }}</option>
        </select>
        <input type="date" v-model="filtros.desde" @change="cargar" />
        <input type="date" v-model="filtros.hasta" @change="cargar" />
        <button class="btn-ghost btn-sm" @click="limpiarFiltros">Limpiar</button>
      </div>

      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Empleado</th>
              <th>Periodo</th>
              <th class="num">Días</th>
              <th>Estatus</th>
              <th>Motivo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="v in solicitudes" :key="v.id">
              <td>
                <div class="principal clickable" @click="$router.push(`/empleados/${v.empleado_id}`)">{{ v.empleado }}</div>
                <div class="muted">{{ v.departamento || 'Sin departamento' }}</div>
              </td>
              <td>{{ formatFechaCorta(v.fecha_inicio) }} — {{ formatFechaCorta(v.fecha_fin) }}</td>
              <td class="num">{{ v.dias }}</td>
              <td><span :class="['badge', badgeEstatus(v.estatus)]">{{ ETIQUETA[v.estatus] }}</span></td>
              <td>{{ v.motivo || '—' }}</td>
              <td>
                <div class="acciones">
                  <template v-if="v.estatus === 'pendiente'">
                    <button class="btn-secondary btn-sm" @click="resolver(v, 'aprobada')">Aprobar</button>
                    <button class="btn-ghost btn-sm" @click="resolver(v, 'rechazada')">Rechazar</button>
                  </template>
                  <button
                    class="btn-ghost btn-sm"
                    v-else-if="v.estatus === 'aprobada' && v.fecha_fin < hoyIso()"
                    @click="resolver(v, 'disfrutada')"
                  >
                    Marcar disfrutada
                  </button>
                  <button class="icon-btn icon-btn--danger" title="Eliminar" @click="eliminar(v)">✕</button>
                </div>
              </td>
            </tr>
            <tr v-if="solicitudes.length === 0">
              <td colspan="6" class="empty">Sin vacaciones registradas con esos filtros</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <template v-else>
      <div class="toolbar">
        <select v-model.number="filtroDeptoSaldos" @change="cargarSaldos">
          <option :value="null">Todos los departamentos</option>
          <option v-for="d in departamentos" :key="d.id" :value="d.id">{{ d.nombre }}</option>
        </select>
        <span class="muted">Un periodo prescribe 18 meses después de cumplirse el año (art. 81 LFT).</span>
      </div>

      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Empleado</th>
              <th>Ingreso</th>
              <th class="num">Años</th>
              <th class="num">Le tocan</th>
              <th class="num">Generados</th>
              <th class="num">Tomados</th>
              <th class="num">Disponibles</th>
              <th>Prescribe</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in saldos" :key="s.id">
              <td>
                <div class="principal clickable" @click="$router.push(`/empleados/${s.id}`)">{{ s.nombre_completo }}</div>
                <div class="muted">{{ s.puesto || 'Sin puesto' }}</div>
              </td>
              <td>{{ formatFechaCorta(s.fecha_ingreso) }}</td>
              <td class="num">{{ s.anios }}</td>
              <td class="num">{{ s.diasDelAnioEnCurso }}</td>
              <td class="num">{{ s.total }}</td>
              <td class="num">{{ s.tomados }}</td>
              <td class="num">
                <b :style="{ color: s.disponibles > 0 ? 'var(--green)' : 'var(--text-3)' }">{{ s.disponibles }}</b>
              </td>
              <td>
                <span v-if="!s.vence || s.anios < 1" class="muted">—</span>
                <span v-else :class="['badge', s.vence < hoyIso() ? 'badge--rojo' : 'badge--verde']">
                  {{ formatFechaCorta(s.vence) }}
                </span>
              </td>
              <td>
                <div class="acciones">
                  <button class="btn-ghost btn-sm" @click="abrirAjuste(s)">Ajustar</button>
                  <button class="btn-secondary btn-sm" @click="abrirNueva(s.id)">Registrar</button>
                </div>
              </td>
            </tr>
            <tr v-if="saldos.length === 0">
              <td colspan="9" class="empty">Aún no hay empleados activos</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Nueva solicitud -->
    <div class="modal-backdrop" v-if="form" @click.self="form = null">
      <div class="modal">
        <div class="modal__titulo">Registrar vacaciones</div>
        <div class="modal__sub" v-if="saldoEmpleado">
          Saldo disponible: <b>{{ saldoEmpleado.disponibles }} días</b>
        </div>

        <div class="campo">
          <label>Empleado</label>
          <select v-model.number="form.empleado_id" @change="alCambiarEmpleado">
            <option :value="null">Selecciona…</option>
            <option v-for="e in empleadosActivos" :key="e.id" :value="e.id">{{ e.nombre_completo }}</option>
          </select>
        </div>

        <div class="campos">
          <div class="campo">
            <label>Del</label>
            <input type="date" v-model="form.fecha_inicio" @change="recalcularDias" />
          </div>
          <div class="campo">
            <label>Al</label>
            <input type="date" v-model="form.fecha_fin" @change="recalcularDias" />
          </div>
          <div class="campo">
            <label>Días a descontar</label>
            <input type="number" min="0" step="0.5" v-model.number="form.dias" />
          </div>
        </div>
        <p class="muted" v-if="diasNaturales">
          {{ diasNaturales }} días naturales; se descuentan {{ form.dias }} hábiles
          (sin contar descansos ni festivos).
        </p>

        <div class="campo">
          <label>Motivo / nota</label>
          <input type="text" v-model="form.motivo" />
        </div>

        <div class="campo">
          <label class="checkbox">
            <input type="checkbox" v-model="form.pagar_prima" />
            Pagar prima vacacional en la nómina del periodo
          </label>
        </div>
        <div class="campo">
          <label class="checkbox">
            <input type="checkbox" v-model="aprobarDirecto" />
            Registrar ya aprobadas
          </label>
        </div>

        <p class="error" v-if="errorForm">{{ errorForm }}</p>

        <div class="modal__acciones">
          <button class="btn-ghost" @click="form = null">Cancelar</button>
          <button class="btn-primary" @click="guardar()">Guardar</button>
        </div>
      </div>
    </div>

    <!-- Ajuste de saldo -->
    <div class="modal-backdrop" v-if="ajuste" @click.self="ajuste = null">
      <div class="modal">
        <div class="modal__titulo">Ajustar saldo — {{ ajuste.nombre }}</div>
        <div class="modal__sub">
          Usa números positivos para agregar días y negativos para descontarlos.
          Los ajustes quedan registrados con su motivo.
        </div>

        <div class="campos">
          <div class="campo">
            <label>Días</label>
            <input type="number" step="0.5" v-model.number="ajuste.dias" />
          </div>
          <div class="campo">
            <label>Motivo</label>
            <input type="text" v-model="ajuste.motivo" placeholder="Días pagados, acuerdo, corrección…" />
          </div>
        </div>

        <ul class="historial" v-if="ajustesPrevios.length">
          <li v-for="a in ajustesPrevios" :key="a.id">
            <span :style="{ color: a.dias > 0 ? 'var(--green)' : 'var(--red)' }">
              {{ a.dias > 0 ? '+' : '' }}{{ a.dias }} d
            </span>
            <span class="muted">{{ a.motivo }}</span>
            <button class="icon-btn icon-btn--danger" @click="eliminarAjuste(a)">✕</button>
          </li>
        </ul>

        <p class="error" v-if="errorForm">{{ errorForm }}</p>

        <div class="modal__acciones">
          <button class="btn-ghost" @click="ajuste = null">Cancelar</button>
          <button class="btn-primary" @click="guardarAjuste">Aplicar ajuste</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import formats from '../mixin/formats'

const ETIQUETA = {
  pendiente: 'Pendiente',
  aprobada: 'Aprobada',
  disfrutada: 'Disfrutada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada'
}

export default {
  name: 'Vacaciones',
  mixins: [formats],
  data() {
    return {
      ETIQUETA,
      tab: 'solicitudes',
      solicitudes: [],
      saldos: [],
      empleadosActivos: [],
      filtros: { estatus: 'todos', departamento_id: null, desde: '', hasta: '' },
      filtroDeptoSaldos: null,
      form: null,
      aprobarDirecto: false,
      saldoEmpleado: null,
      diasNaturales: 0,
      errorForm: '',
      ajuste: null,
      ajustesPrevios: []
    }
  },
  computed: {
    ...mapGetters(['departamentos', 'usuarioActual']),
    pendientes() {
      return this.solicitudes.filter((s) => s.estatus === 'pendiente').length
    }
  },
  async mounted() {
    await this.cargar()
    this.empleadosActivos = await window.api.empleados.listar({ estatus: 'activo' })
  },
  methods: {
    async cargar() {
      this.solicitudes = await window.api.vacaciones.listar(this.filtros)
    },
    async cambiarASaldos() {
      this.tab = 'saldos'
      await this.cargarSaldos()
    },
    async cargarSaldos() {
      this.saldos = await window.api.vacaciones.saldos({ departamento_id: this.filtroDeptoSaldos })
    },
    limpiarFiltros() {
      this.filtros = { estatus: 'todos', departamento_id: null, desde: '', hasta: '' }
      this.cargar()
    },
    badgeEstatus(estatus) {
      return {
        aprobada: 'badge--verde',
        disfrutada: 'badge--azul',
        pendiente: 'badge--ambar',
        rechazada: 'badge--rojo',
        cancelada: 'badge--rojo'
      }[estatus] || ''
    },

    abrirNueva(empleadoId = null) {
      this.errorForm = ''
      this.aprobarDirecto = false
      this.diasNaturales = 0
      this.saldoEmpleado = null
      this.form = {
        empleado_id: empleadoId,
        fecha_inicio: this.hoyIso(),
        fecha_fin: this.hoyIso(),
        dias: 1,
        motivo: '',
        pagar_prima: false
      }
      if (empleadoId) this.alCambiarEmpleado()
    },
    async alCambiarEmpleado() {
      if (!this.form.empleado_id) {
        this.saldoEmpleado = null
        return
      }
      this.saldoEmpleado = await window.api.vacaciones.saldo(this.form.empleado_id)
      await this.recalcularDias()
    },
    async recalcularDias() {
      if (!this.form.empleado_id || !this.form.fecha_inicio || !this.form.fecha_fin) return
      const res = await window.api.vacaciones.calcularDias({
        empleado_id: this.form.empleado_id,
        fecha_inicio: this.form.fecha_inicio,
        fecha_fin: this.form.fecha_fin
      })
      this.form.dias = res.dias
      this.diasNaturales = res.naturales
    },
    async guardar(forzar = false) {
      this.errorForm = ''
      const res = await window.api.vacaciones.crear({
        ...this.form,
        estatus: this.aprobarDirecto ? 'aprobada' : 'pendiente',
        forzar,
        usuario_id: this.usuarioActual?.id
      })

      if (!res.ok) {
        // El backend avisa cuando el empleado no tiene saldo suficiente y deja decidir.
        if (res.requiereConfirmacion && confirm(res.mensaje)) return this.guardar(true)
        this.errorForm = res.mensaje
        return
      }
      this.form = null
      this.$store.dispatch('notificar', { mensaje: 'Vacaciones registradas' })
      await this.cargar()
      if (this.tab === 'saldos') await this.cargarSaldos()
    },
    async resolver(v, estatus) {
      await window.api.vacaciones.resolver({ id: v.id, estatus, usuario_id: this.usuarioActual?.id })
      this.$store.dispatch('notificar', { mensaje: `Solicitud ${ETIQUETA[estatus].toLowerCase()}` })
      await this.cargar()
    },
    async eliminar(v) {
      if (!confirm(`¿Eliminar el registro de ${v.empleado}?`)) return
      await window.api.vacaciones.eliminar(v.id)
      await this.cargar()
    },

    async abrirAjuste(s) {
      this.errorForm = ''
      this.ajuste = { empleado_id: s.id, nombre: s.nombre_completo, dias: 0, motivo: '' }
      this.ajustesPrevios = await window.api.vacaciones.ajustes(s.id)
    },
    async guardarAjuste() {
      this.errorForm = ''
      const res = await window.api.vacaciones.ajustar({
        ...this.ajuste,
        usuario_id: this.usuarioActual?.id
      })
      if (!res.ok) {
        this.errorForm = res.mensaje
        return
      }
      this.ajuste = null
      this.$store.dispatch('notificar', { mensaje: 'Ajuste aplicado' })
      await this.cargarSaldos()
    },
    async eliminarAjuste(a) {
      await window.api.vacaciones.eliminarAjuste(a.id)
      this.ajustesPrevios = await window.api.vacaciones.ajustes(this.ajuste.empleado_id)
      await this.cargarSaldos()
    }
  }
}
</script>

<style scoped>
.conteo {
  margin-left: 6px;
  background: var(--amber-soft);
  color: #8A6400;
  border-radius: 10px;
  padding: 1px 6px;
  font-size: 10.5px;
}

.historial {
  list-style: none;
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 160px;
  overflow-y: auto;
}

.historial li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12.5px;
  font-weight: 600;
  border-bottom: 1px solid #F3F1FA;
  padding-bottom: 5px;
}

.historial .muted {
  flex: 1;
  font-weight: 400;
}
</style>
