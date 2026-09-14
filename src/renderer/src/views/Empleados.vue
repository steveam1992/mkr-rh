<template>
  <div class="page">
    <div class="page__head">
      <div>
        <div class="page__title">Empleados</div>
        <div class="page__subtitle">{{ empleados.length }} registro(s) · {{ etiquetaEstatus }}</div>
      </div>
      <div class="page__acciones">
        <button class="btn-primary" @click="abrirNuevo">+ Nuevo empleado</button>
      </div>
    </div>

    <div class="toolbar">
      <input class="crece" type="text" placeholder="Buscar por nombre, número, CURP o RFC…" v-model="filtros.q" @input="cargarDebounce" />
      <select v-model.number="filtros.departamento_id" @change="cargar">
        <option :value="null">Todos los departamentos</option>
        <option v-for="d in departamentos" :key="d.id" :value="d.id">{{ d.nombre }}</option>
      </select>
      <select v-model.number="filtros.puesto_id" @change="cargar">
        <option :value="null">Todos los puestos</option>
        <option v-for="p in puestos" :key="p.id" :value="p.id">{{ p.nombre }}</option>
      </select>
      <select v-model="filtros.estatus" @change="cargar">
        <option value="activo">Activos</option>
        <option value="baja">Dados de baja</option>
        <option value="todos">Todos</option>
      </select>
    </div>

    <div class="table-scroll">
      <table class="data-table">
        <thead>
          <tr>
            <th>Empleado</th>
            <th>Departamento</th>
            <th>Puesto</th>
            <th>Ingreso</th>
            <th>Antigüedad</th>
            <th class="num">Salario mensual</th>
            <th>Contrato</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in empleados" :key="e.id">
            <td>
              <div class="persona clickable" @click="abrirDetalle(e)">
                <div class="avatar">
                  <img v-if="e.foto" :src="e.foto" alt="" />
                  <span v-else>{{ iniciales(e.nombre_completo) }}</span>
                </div>
                <div>
                  <div class="principal">{{ e.nombre_completo }}</div>
                  <div class="muted">{{ e.numero_empleado }}</div>
                </div>
              </div>
            </td>
            <td>{{ e.departamento || '—' }}</td>
            <td>{{ e.puesto || '—' }}</td>
            <td>{{ formatFechaCorta(e.fecha_ingreso) }}</td>
            <td>{{ e.antiguedad }}</td>
            <td class="num">{{ formatMoney(e.salario_mensual) }}</td>
            <td>
              <span :class="['badge', badgeContrato(e)]">{{ ETIQUETA_CONTRATO[e.tipo_contrato] || e.tipo_contrato }}</span>
            </td>
            <td>
              <div class="acciones">
                <span class="badge badge--rojo" v-if="e.estatus === 'baja'">Baja</span>
                <button class="icon-btn" title="Ver expediente" @click="abrirDetalle(e)">›</button>
              </div>
            </td>
          </tr>
          <tr v-if="empleados.length === 0">
            <td colspan="8" class="empty">
              {{ filtros.q ? 'Ningún empleado coincide con la búsqueda' : 'Aún no hay empleados registrados' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <EmpleadoForm v-if="mostrarForm" @cerrar="mostrarForm = false" @guardado="alGuardar" />
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import formats from '../mixin/formats'
import EmpleadoForm from '../components/EmpleadoForm.vue'

const ETIQUETA_CONTRATO = {
  indeterminado: 'Indeterminado',
  determinado: 'Determinado',
  prueba: 'Prueba',
  capacitacion: 'Capacitación',
  honorarios: 'Honorarios'
}

export default {
  name: 'Empleados',
  mixins: [formats],
  components: { EmpleadoForm },
  data() {
    return {
      ETIQUETA_CONTRATO,
      empleados: [],
      filtros: { q: '', departamento_id: null, puesto_id: null, estatus: 'activo' },
      mostrarForm: false,
      temporizador: null
    }
  },
  computed: {
    ...mapGetters(['departamentos', 'puestos']),
    etiquetaEstatus() {
      return { activo: 'activos', baja: 'dados de baja', todos: 'todos' }[this.filtros.estatus]
    }
  },
  mounted() {
    this.cargar()
  },
  methods: {
    async cargar() {
      this.empleados = await window.api.empleados.listar(this.filtros)
    },
    cargarDebounce() {
      clearTimeout(this.temporizador)
      this.temporizador = setTimeout(this.cargar, 220)
    },
    abrirNuevo() {
      this.mostrarForm = true
    },
    abrirDetalle(empleado) {
      this.$router.push(`/empleados/${empleado.id}`)
    },
    alGuardar(id) {
      this.mostrarForm = false
      if (id) this.$router.push(`/empleados/${id}`)
      else this.cargar()
    },
    badgeContrato(e) {
      if (e.tipo_contrato === 'indeterminado') return 'badge--verde'
      if (!e.fecha_fin_contrato) return 'badge--azul'
      return e.fecha_fin_contrato < this.hoyIso() ? 'badge--rojo' : 'badge--ambar'
    }
  }
}
</script>

<style scoped>
.persona {
  display: flex;
  align-items: center;
  gap: 10px;
}

.avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--primary-soft);
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
  overflow: hidden;
  flex-shrink: 0;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
