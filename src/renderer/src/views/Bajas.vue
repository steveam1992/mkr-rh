<template>
  <div class="page">
    <div class="page__head">
      <div>
        <div class="page__title">Bajas y finiquitos</div>
        <div class="page__subtitle">Historial de salidas con el detalle de lo que se pagó</div>
      </div>
      <div class="page__acciones">
        <router-link to="/reportes" class="btn-secondary">Exportar a Excel</router-link>
      </div>
    </div>

    <div class="kpis">
      <div class="kpi">
        <div class="kpi__valor">{{ bajas.length }}</div>
        <div class="kpi__label">Bajas en el periodo</div>
      </div>
      <div class="kpi">
        <div class="kpi__valor">{{ formatMoney(totalPagado) }}</div>
        <div class="kpi__label">Total en finiquitos</div>
      </div>
      <div class="kpi">
        <div class="kpi__valor">{{ motivoMasComun }}</div>
        <div class="kpi__label">Motivo más frecuente</div>
      </div>
      <div class="kpi">
        <div class="kpi__valor">{{ antiguedadPromedio }}</div>
        <div class="kpi__label">Antigüedad promedio al salir</div>
      </div>
    </div>

    <div class="toolbar">
      <input type="date" v-model="filtros.desde" @change="cargar" />
      <input type="date" v-model="filtros.hasta" @change="cargar" />
      <button class="btn-ghost btn-sm" @click="limpiar">Todo el histórico</button>
    </div>

    <div class="table-scroll">
      <table class="data-table">
        <thead>
          <tr>
            <th>Empleado</th>
            <th>Departamento</th>
            <th>Ingreso</th>
            <th>Baja</th>
            <th>Antigüedad</th>
            <th>Motivo</th>
            <th class="num">Vacaciones</th>
            <th class="num">Aguinaldo</th>
            <th class="num">Finiquito</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="b in bajas" :key="b.id">
            <td>
              <div class="principal clickable" @click="$router.push(`/empleados/${b.empleado_id}`)">{{ b.nombre_completo }}</div>
              <div class="muted">{{ b.puesto || 'Sin puesto' }}</div>
            </td>
            <td>{{ b.departamento || '—' }}</td>
            <td>{{ formatFechaCorta(b.fecha_ingreso) }}</td>
            <td>{{ formatFechaCorta(b.fecha_baja) }}</td>
            <td>{{ b.antiguedad }}</td>
            <td><span :class="['badge', badgeMotivo(b.motivo)]">{{ ETIQUETA[b.motivo] || b.motivo }}</span></td>
            <td class="num">{{ formatMoney(b.monto_vacaciones + b.monto_prima_vacacional) }}</td>
            <td class="num">{{ formatMoney(b.monto_aguinaldo) }}</td>
            <td class="num"><b>{{ formatMoney(b.total_finiquito) }}</b></td>
          </tr>
          <tr v-if="bajas.length === 0">
            <td colspan="9" class="empty">Sin bajas registradas en ese rango</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import formats from '../mixin/formats'

const ETIQUETA = {
  renuncia: 'Renuncia',
  despido: 'Despido',
  fin_contrato: 'Fin de contrato',
  abandono: 'Abandono',
  jubilacion: 'Jubilación',
  defuncion: 'Defunción',
  otro: 'Otro'
}

export default {
  name: 'Bajas',
  mixins: [formats],
  data() {
    return {
      ETIQUETA,
      bajas: [],
      filtros: { desde: `${new Date().getFullYear()}-01-01`, hasta: '' }
    }
  },
  computed: {
    totalPagado() {
      return this.bajas.reduce((t, b) => t + Number(b.total_finiquito || 0), 0)
    },
    motivoMasComun() {
      if (this.bajas.length === 0) return '—'
      const conteo = {}
      for (const b of this.bajas) conteo[b.motivo] = (conteo[b.motivo] || 0) + 1
      const [motivo] = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0]
      return ETIQUETA[motivo] || motivo
    },
    antiguedadPromedio() {
      if (this.bajas.length === 0) return '—'
      const dias = this.bajas.reduce((t, b) => {
        const ingreso = new Date(b.fecha_ingreso)
        const baja = new Date(b.fecha_baja)
        return t + Math.max(0, (baja - ingreso) / 86400000)
      }, 0) / this.bajas.length
      const anios = dias / 365
      return anios >= 1 ? `${anios.toFixed(1)} años` : `${Math.round(dias / 30)} meses`
    }
  },
  mounted() {
    this.cargar()
  },
  methods: {
    async cargar() {
      this.bajas = await window.api.empleados.bajas(this.filtros)
    },
    limpiar() {
      this.filtros = { desde: '', hasta: '' }
      this.cargar()
    },
    badgeMotivo(motivo) {
      return {
        renuncia: 'badge--azul',
        despido: 'badge--rojo',
        fin_contrato: 'badge--ambar',
        abandono: 'badge--rojo',
        jubilacion: 'badge--verde'
      }[motivo] || ''
    }
  }
}
</script>

<style scoped>
.kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 12px;
  flex-shrink: 0;
}

.kpi {
  background: var(--surface-2);
  border-radius: var(--radius-sm);
  padding: 13px 15px;
}

.kpi__valor {
  font-size: 19px;
  font-weight: 800;
  letter-spacing: -0.5px;
}

.kpi__label {
  font-size: 11.5px;
  color: var(--text-2);
  margin-top: 2px;
}
</style>
