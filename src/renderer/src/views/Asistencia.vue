<template>
  <div class="page">
    <div class="page__head">
      <div>
        <div class="page__title">Asistencia</div>
        <div class="page__subtitle">
          Captura diaria, calendario de ausencias y concentrado de incidencias
        </div>
      </div>
      <div class="page__acciones" v-if="tab === 'captura'">
        <button class="btn-ghost" @click="marcarTodos">Marcar todos presentes</button>
        <button class="btn-primary" :disabled="guardando" @click="guardar">
          {{ guardando ? 'Guardando...' : 'Guardar día' }}
        </button>
      </div>
    </div>

    <div class="tabs">
      <button class="tab" :class="{ 'tab--activa': tab === 'captura' }" @click="tab = 'captura'">Captura del día</button>
      <button class="tab" :class="{ 'tab--activa': tab === 'calendario' }" @click="irACalendario">Calendario mensual</button>
      <button class="tab" :class="{ 'tab--activa': tab === 'resumen' }" @click="irAResumen">Concentrado</button>
    </div>

    <!-- Captura -->
    <template v-if="tab === 'captura'">
      <div class="toolbar">
        <input type="date" v-model="fecha" :max="hoyIso()" @change="cargarDia" />
        <select v-model.number="departamentoId" @change="cargarDia">
          <option :value="null">Todos los departamentos</option>
          <option v-for="d in departamentos" :key="d.id" :value="d.id">{{ d.nombre }}</option>
        </select>
        <span class="muted">{{ filas.length }} empleado(s)</span>
      </div>

      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Empleado</th>
              <th>Horario</th>
              <th>Entrada</th>
              <th>Salida</th>
              <th>Estatus</th>
              <th class="num">Extra (h)</th>
              <th>Nota</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="f in filas" :key="f.empleado_id" :class="{ bloqueada: f.bloqueado }">
              <td>
                <div class="principal">{{ f.nombre_completo }}</div>
                <div class="muted">{{ f.departamento || 'Sin departamento' }}</div>
              </td>
              <td class="muted">{{ f.hora_entrada_esperada || '—' }} – {{ f.hora_salida_esperada || '—' }}</td>
              <td><input type="time" v-model="f.entrada" :disabled="f.bloqueado" /></td>
              <td><input type="time" v-model="f.salida" :disabled="f.bloqueado" /></td>
              <td>
                <select v-model="f.estatus" :disabled="f.bloqueado">
                  <option v-for="(label, clave) in ETIQUETA" :key="clave" :value="clave">{{ label }}</option>
                </select>
              </td>
              <td class="num"><input type="number" min="0" step="0.5" v-model.number="f.horas_extra" :disabled="f.bloqueado" /></td>
              <td><input type="text" v-model="f.nota" :disabled="f.bloqueado" placeholder="—" /></td>
            </tr>
            <tr v-if="filas.length === 0">
              <td colspan="7" class="empty">No hay empleados activos para ese filtro</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="muted">
        Las filas en gris ya tienen vacaciones, incapacidad o permiso aprobado ese día: no se capturan aquí.
      </p>
    </template>

    <!-- Calendario -->
    <template v-else-if="tab === 'calendario'">
      <div class="toolbar">
        <select v-model.number="mes" @change="cargarCalendario">
          <option v-for="(m, i) in MESES" :key="i" :value="i + 1">{{ m }}</option>
        </select>
        <select v-model.number="anio" @change="cargarCalendario">
          <option v-for="a in anios" :key="a" :value="a">{{ a }}</option>
        </select>
        <select v-model.number="departamentoId" @change="cargarCalendario">
          <option :value="null">Todos los departamentos</option>
          <option v-for="d in departamentos" :key="d.id" :value="d.id">{{ d.nombre }}</option>
        </select>
        <div class="leyenda">
          <span v-for="(color, clave) in COLORES" :key="clave">
            <i :style="{ background: color }"></i>{{ ETIQUETA_CAL[clave] }}
          </span>
        </div>
      </div>

      <div class="table-scroll">
        <table class="calendario">
          <thead>
            <tr>
              <th class="calendario__nombre">Empleado</th>
              <th v-for="d in calendario.dias" :key="d.fecha" :class="{ finde: d.diaSemana === 0 || d.diaSemana === 6 }">
                {{ d.dia }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="f in calendario.filas" :key="f.empleado_id">
              <td class="calendario__nombre clickable" @click="$router.push(`/empleados/${f.empleado_id}`)">
                {{ f.nombre_completo }}
              </td>
              <td v-for="d in calendario.dias" :key="d.fecha">
                <span
                  class="celda"
                  :style="{ background: COLORES[f.celdas[d.fecha]] || 'transparent' }"
                  :title="`${f.nombre_completo} · ${d.fecha} · ${ETIQUETA_CAL[f.celdas[d.fecha]] || 'sin registro'}`"
                ></span>
              </td>
            </tr>
            <tr v-if="calendario.filas?.length === 0">
              <td :colspan="(calendario.dias?.length || 0) + 1" class="empty">Sin empleados activos</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Concentrado -->
    <template v-else>
      <div class="toolbar">
        <input type="date" v-model="rango.desde" @change="cargarResumen" />
        <input type="date" v-model="rango.hasta" @change="cargarResumen" />
        <select v-model.number="departamentoId" @change="cargarResumen">
          <option :value="null">Todos los departamentos</option>
          <option v-for="d in departamentos" :key="d.id" :value="d.id">{{ d.nombre }}</option>
        </select>
      </div>

      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Empleado</th>
              <th>Departamento</th>
              <th class="num">Asistencias</th>
              <th class="num">Retardos</th>
              <th class="num">Min. retardo</th>
              <th class="num">Faltas</th>
              <th class="num">Vacaciones</th>
              <th class="num">Incapacidad</th>
              <th class="num">Horas</th>
              <th class="num">Extra</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in resumen" :key="r.empleado_id">
              <td class="principal clickable" @click="$router.push(`/empleados/${r.empleado_id}`)">{{ r.empleado }}</td>
              <td>{{ r.departamento || '—' }}</td>
              <td class="num">{{ r.asistencias }}</td>
              <td class="num"><b v-if="r.retardos" style="color: var(--amber)">{{ r.retardos }}</b><span v-else>0</span></td>
              <td class="num">{{ r.minutos_retardo }}</td>
              <td class="num"><b v-if="r.faltas" style="color: var(--red)">{{ r.faltas }}</b><span v-else>0</span></td>
              <td class="num">{{ r.vacaciones }}</td>
              <td class="num">{{ r.incapacidades }}</td>
              <td class="num">{{ r.horas }}</td>
              <td class="num">{{ r.horas_extra }}</td>
            </tr>
            <tr v-if="resumen.length === 0">
              <td colspan="10" class="empty">Sin datos en ese rango</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import formats from '../mixin/formats'

const ETIQUETA = {
  asistencia: 'Asistencia',
  retardo: 'Retardo',
  falta: 'Falta',
  descanso: 'Descanso',
  festivo: 'Día festivo',
  permiso: 'Permiso',
  vacaciones: 'Vacaciones',
  incapacidad: 'Incapacidad'
}

const ETIQUETA_CAL = { ...ETIQUETA }

const COLORES = {
  asistencia: '#00B894',
  retardo: '#E1A200',
  falta: '#E74C3C',
  vacaciones: '#6C5CE7',
  incapacidad: '#0984E3',
  permiso: '#A29BFE',
  descanso: '#EAE7F6',
  festivo: '#D8D3F2'
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export default {
  name: 'Asistencia',
  mixins: [formats],
  data() {
    const ahora = new Date()
    return {
      ETIQUETA,
      ETIQUETA_CAL,
      COLORES,
      MESES,
      tab: 'captura',
      fecha: this.hoyIso(),
      departamentoId: null,
      filas: [],
      guardando: false,
      anio: ahora.getFullYear(),
      mes: ahora.getMonth() + 1,
      calendario: { dias: [], filas: [] },
      rango: { desde: '', hasta: '' },
      resumen: []
    }
  },
  computed: {
    ...mapGetters(['departamentos', 'usuarioActual']),
    anios() {
      const actual = new Date().getFullYear()
      return [actual - 2, actual - 1, actual, actual + 1]
    }
  },
  mounted() {
    const f = new Date()
    this.rango.desde = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-01`
    this.rango.hasta = this.hoyIso()
    this.cargarDia()
  },
  methods: {
    async cargarDia() {
      const datos = await window.api.asistencia.dia({
        fecha: this.fecha,
        departamento_id: this.departamentoId
      })
      this.filas = datos.map((f) => ({
        ...f,
        entrada: f.registro?.hora_entrada || (f.bloqueado ? '' : f.hora_entrada_esperada || ''),
        salida: f.registro?.hora_salida || (f.bloqueado ? '' : f.hora_salida_esperada || ''),
        estatus: f.registro?.estatus || f.sugerido,
        horas_extra: f.registro?.horas_extra || 0,
        nota: f.registro?.nota || ''
      }))
    },
    marcarTodos() {
      for (const f of this.filas) {
        if (f.bloqueado || f.estatus === 'descanso' || f.estatus === 'festivo') continue
        f.entrada = f.entrada || f.hora_entrada_esperada || ''
        f.salida = f.salida || f.hora_salida_esperada || ''
        f.estatus = 'asistencia'
      }
    },
    async guardar() {
      this.guardando = true
      try {
        const registros = this.filas
          .filter((f) => !f.bloqueado)
          .map((f) => ({
            empleado_id: f.empleado_id,
            hora_entrada: f.entrada || null,
            hora_salida: f.salida || null,
            estatus: f.estatus,
            horas_extra: f.horas_extra,
            nota: f.nota
          }))

        const res = await window.api.asistencia.guardarLote({
          fecha: this.fecha,
          registros,
          usuario_id: this.usuarioActual?.id
        })
        if (!res.ok) {
          this.$store.dispatch('notificar', { mensaje: res.mensaje, tipo: 'error' })
          return
        }
        this.$store.dispatch('notificar', { mensaje: `${res.guardados} registro(s) guardados` })
        await this.cargarDia()
      } finally {
        this.guardando = false
      }
    },
    async irACalendario() {
      this.tab = 'calendario'
      await this.cargarCalendario()
    },
    async cargarCalendario() {
      this.calendario = await window.api.asistencia.calendario({
        anio: this.anio,
        mes: this.mes,
        departamento_id: this.departamentoId
      })
    },
    async irAResumen() {
      this.tab = 'resumen'
      await this.cargarResumen()
    },
    async cargarResumen() {
      this.resumen = await window.api.asistencia.resumen({
        desde: this.rango.desde,
        hasta: this.rango.hasta,
        departamento_id: this.departamentoId
      })
    }
  }
}
</script>

<style scoped>
.bloqueada {
  opacity: 0.55;
  background: var(--surface-2);
}

.data-table input,
.data-table select {
  padding: 5px 8px;
  font-size: 12.5px;
  min-width: 92px;
}

.leyenda {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 11px;
  color: var(--text-2);
  margin-left: auto;
}

.leyenda span {
  display: flex;
  align-items: center;
  gap: 5px;
}

.leyenda i {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  display: inline-block;
}

.calendario {
  border-collapse: collapse;
  font-size: 11px;
}

.calendario th {
  position: sticky;
  top: 0;
  background: var(--surface);
  padding: 5px 2px;
  border-bottom: 2px solid var(--border);
  color: var(--text-2);
  font-weight: 700;
  min-width: 21px;
  text-align: center;
  z-index: 1;
}

.calendario th.finde {
  color: var(--text-3);
}

.calendario td {
  padding: 3px 2px;
  border-bottom: 1px solid #F3F1FA;
  text-align: center;
}

.calendario__nombre {
  position: sticky;
  left: 0;
  background: var(--surface);
  text-align: left !important;
  padding-right: 12px !important;
  white-space: nowrap;
  font-size: 12px;
  color: var(--text-1);
  z-index: 2;
}

.celda {
  display: block;
  width: 17px;
  height: 17px;
  border-radius: 4px;
  margin: 0 auto;
  border: 1px solid #F0EEFA;
}
</style>
