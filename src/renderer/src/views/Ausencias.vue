<template>
  <div class="page">
    <div class="page__head">
      <div>
        <div class="page__title">Permisos y faltas</div>
        <div class="page__subtitle">
          Permisos con y sin goce, faltas, retardos y home office
        </div>
      </div>
      <div class="page__acciones">
        <button class="btn-primary" @click="abrir()">+ Registrar</button>
      </div>
    </div>

    <div class="toolbar">
      <select v-model="filtros.tipo" @change="cargar">
        <option value="todos">Todos los tipos</option>
        <option v-for="(label, clave) in ETIQUETA" :key="clave" :value="clave">{{ label }}</option>
      </select>
      <select v-model="filtros.estatus" @change="cargar">
        <option value="todos">Todos los estatus</option>
        <option value="pendiente">Pendientes</option>
        <option value="aprobado">Aprobados</option>
        <option value="rechazado">Rechazados</option>
      </select>
      <select v-model.number="filtros.departamento_id" @change="cargar">
        <option :value="null">Todos los departamentos</option>
        <option v-for="d in departamentos" :key="d.id" :value="d.id">{{ d.nombre }}</option>
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
            <th>Tipo</th>
            <th>Fecha</th>
            <th class="num">Días / horas</th>
            <th>Motivo</th>
            <th class="num">Descuento</th>
            <th>Estatus</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in lista" :key="p.id">
            <td>
              <div class="principal clickable" @click="$router.push(`/empleados/${p.empleado_id}`)">{{ p.empleado }}</div>
              <div class="muted">{{ p.departamento || 'Sin departamento' }}</div>
            </td>
            <td><span :class="['badge', badgeTipo(p.tipo)]">{{ ETIQUETA[p.tipo] || p.tipo }}</span></td>
            <td>
              {{ formatFechaCorta(p.fecha_inicio) }}
              <span v-if="p.fecha_fin !== p.fecha_inicio"> — {{ formatFechaCorta(p.fecha_fin) }}</span>
            </td>
            <td class="num">{{ p.tipo === 'retardo' ? `${p.horas} h` : p.dias }}</td>
            <td>{{ p.motivo || '—' }}</td>
            <td class="num">
              <span v-if="p.descuenta">{{ formatMoney(p.descuento_estimado) }}</span>
              <span v-else class="muted">—</span>
            </td>
            <td><span :class="['badge', badgeEstatus(p.estatus)]">{{ p.estatus }}</span></td>
            <td>
              <div class="acciones">
                <template v-if="p.estatus === 'pendiente'">
                  <button class="btn-secondary btn-sm" @click="resolver(p, 'aprobado')">Aprobar</button>
                  <button class="btn-ghost btn-sm" @click="resolver(p, 'rechazado')">Rechazar</button>
                </template>
                <button class="icon-btn" title="Editar" @click="abrir(p)">✎</button>
                <button class="icon-btn icon-btn--danger" title="Eliminar" @click="eliminar(p)">✕</button>
              </div>
            </td>
          </tr>
          <tr v-if="lista.length === 0">
            <td colspan="8" class="empty">Sin registros con esos filtros</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="modal-backdrop" v-if="form" @click.self="form = null">
      <div class="modal">
        <div class="modal__titulo">{{ form.id ? 'Editar registro' : 'Registrar permiso o falta' }}</div>
        <div class="modal__sub">
          Las faltas y los retardos se guardan ya aprobados: son hechos, no solicitudes.
        </div>

        <div class="campo">
          <label>Empleado</label>
          <select v-model.number="form.empleado_id" :disabled="!!form.id">
            <option :value="null">Selecciona…</option>
            <option v-for="e in empleados" :key="e.id" :value="e.id">{{ e.nombre_completo }}</option>
          </select>
        </div>

        <div class="campo">
          <label>Tipo</label>
          <select v-model="form.tipo" @change="alCambiarTipo">
            <option v-for="(label, clave) in ETIQUETA" :key="clave" :value="clave">{{ label }}</option>
          </select>
        </div>

        <div class="campos">
          <div class="campo">
            <label>{{ form.tipo === 'retardo' ? 'Fecha' : 'Del' }}</label>
            <input type="date" v-model="form.fecha_inicio" @change="calcularDias" />
          </div>
          <div class="campo" v-if="form.tipo !== 'retardo'">
            <label>Al</label>
            <input type="date" v-model="form.fecha_fin" @change="calcularDias" />
          </div>
          <div class="campo" v-if="form.tipo === 'retardo'">
            <label>Horas</label>
            <input type="number" min="0" step="0.25" v-model.number="form.horas" />
          </div>
          <div class="campo" v-else>
            <label>Días</label>
            <input type="number" min="0" step="0.5" v-model.number="form.dias" />
          </div>
        </div>

        <div class="campo">
          <label>Motivo</label>
          <input type="text" v-model="form.motivo" />
        </div>

        <div class="campo">
          <label class="checkbox">
            <input type="checkbox" v-model="form.descuenta" />
            Descontar de la nómina
          </label>
        </div>

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
  con_goce: 'Permiso con goce',
  sin_goce: 'Permiso sin goce',
  falta: 'Falta',
  retardo: 'Retardo',
  home_office: 'Home office',
  otro: 'Otro'
}

const DESCUENTA = { sin_goce: true, falta: true }

export default {
  name: 'Ausencias',
  mixins: [formats],
  data() {
    return {
      ETIQUETA,
      lista: [],
      empleados: [],
      filtros: { tipo: 'todos', estatus: 'todos', departamento_id: null, desde: '', hasta: '' },
      form: null,
      error: ''
    }
  },
  computed: {
    ...mapGetters(['departamentos', 'usuarioActual'])
  },
  async mounted() {
    await this.cargar()
    this.empleados = await window.api.empleados.listar({ estatus: 'activo' })
  },
  methods: {
    async cargar() {
      this.lista = await window.api.permisos.listar(this.filtros)
    },
    limpiar() {
      this.filtros = { tipo: 'todos', estatus: 'todos', departamento_id: null, desde: '', hasta: '' }
      this.cargar()
    },
    badgeTipo(tipo) {
      return {
        con_goce: 'badge--azul',
        sin_goce: 'badge--ambar',
        falta: 'badge--rojo',
        retardo: 'badge--ambar',
        home_office: 'badge--verde'
      }[tipo] || ''
    },
    badgeEstatus(estatus) {
      return { aprobado: 'badge--verde', pendiente: 'badge--ambar', rechazado: 'badge--rojo' }[estatus] || ''
    },
    abrir(permiso = null) {
      this.error = ''
      this.form = permiso
        ? { ...permiso, descuenta: !!permiso.descuenta }
        : {
            empleado_id: null,
            tipo: 'con_goce',
            fecha_inicio: this.hoyIso(),
            fecha_fin: this.hoyIso(),
            dias: 1,
            horas: 0,
            motivo: '',
            descuenta: false
          }
    },
    alCambiarTipo() {
      this.form.descuenta = !!DESCUENTA[this.form.tipo]
      if (this.form.tipo === 'retardo') {
        this.form.fecha_fin = this.form.fecha_inicio
        this.form.dias = 0
      } else if (!this.form.dias) {
        this.form.dias = 1
      }
    },
    calcularDias() {
      if (this.form.tipo === 'retardo') {
        this.form.fecha_fin = this.form.fecha_inicio
        return
      }
      const { fecha_inicio: a, fecha_fin: b } = this.form
      if (!a || !b || b < a) return
      this.form.dias = Math.round((new Date(b) - new Date(a)) / 86400000) + 1
    },
    async guardar() {
      this.error = ''
      const data = { ...this.form, usuario_id: this.usuarioActual?.id }
      const res = this.form.id
        ? await window.api.permisos.actualizar({ id: this.form.id, data })
        : await window.api.permisos.crear(data)

      if (!res.ok) {
        this.error = res.mensaje
        return
      }
      this.form = null
      this.$store.dispatch('notificar', { mensaje: 'Registro guardado' })
      await this.cargar()
    },
    async resolver(p, estatus) {
      await window.api.permisos.resolver({ id: p.id, estatus, usuario_id: this.usuarioActual?.id })
      await this.cargar()
    },
    async eliminar(p) {
      if (!confirm(`¿Eliminar el registro de ${p.empleado}?`)) return
      await window.api.permisos.eliminar(p.id)
      await this.cargar()
    }
  }
}
</script>
