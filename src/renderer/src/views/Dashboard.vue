<template>
  <div class="page">
    <div class="page__head">
      <div>
        <div class="page__title">Hola, {{ primerNombre }}</div>
        <div class="page__subtitle">{{ fechaLarga }}</div>
      </div>
      <div class="page__acciones">
        <router-link to="/empleados" class="btn-secondary">Ver plantilla</router-link>
        <router-link to="/reportes" class="btn-primary">Reportes</router-link>
      </div>
    </div>

    <div class="scroll">
      <div class="kpis">
        <div class="kpi">
          <div class="kpi__valor">{{ resumen.activos ?? '—' }}</div>
          <div class="kpi__label">Empleados activos</div>
        </div>
        <div class="kpi">
          <div class="kpi__valor">{{ resumen.ausentesHoy ?? '—' }}</div>
          <div class="kpi__label">Ausentes hoy</div>
        </div>
        <div class="kpi">
          <div class="kpi__valor">{{ formatMoney(resumen.nominaMensual) }}</div>
          <div class="kpi__label">Nómina mensual</div>
        </div>
        <div class="kpi">
          <div class="kpi__valor">{{ resumen.rotacion ?? 0 }}%</div>
          <div class="kpi__label">Rotación del año</div>
        </div>
        <div class="kpi">
          <div class="kpi__valor">{{ resumen.aniosPromedio ?? 0 }}</div>
          <div class="kpi__label">Antigüedad promedio (años)</div>
        </div>
        <div class="kpi kpi--accion" v-if="pendientes > 0" @click="$router.push('/vacaciones')">
          <div class="kpi__valor">{{ pendientes }}</div>
          <div class="kpi__label">Solicitudes por autorizar</div>
        </div>
      </div>

      <div class="columnas">
        <section class="card">
          <div class="card__titulo">Pendientes de RH</div>
          <ul class="alertas" v-if="alertas.length">
            <li
              v-for="(a, i) in alertas.slice(0, 8)"
              :key="i"
              :class="`alerta alerta--${a.gravedad}`"
              @click="irAEmpleado(a)"
            >
              <span class="alerta__icono" v-html="ICONS[iconoAlerta(a.tipo)]"></span>
              <div>
                <div class="alerta__titulo">{{ a.titulo }}</div>
                <div class="alerta__detalle">{{ a.detalle }}</div>
              </div>
            </li>
          </ul>
          <p class="empty" v-else>Nada pendiente. Todo en orden.</p>
          <p class="muted" v-if="alertas.length > 8">y {{ alertas.length - 8 }} más…</p>
        </section>

        <section class="card">
          <div class="card__titulo">Quién no está hoy</div>
          <ul class="ausentes" v-if="ausencias.length">
            <li v-for="(a, i) in ausencias" :key="i">
              <div>
                <div class="ausente__nombre">{{ a.empleado }}</div>
                <div class="muted">{{ a.departamento || 'Sin departamento' }}</div>
              </div>
              <div class="ausente__derecha">
                <span :class="['badge', badgeMotivo(a.motivo)]">{{ ETIQUETA_MOTIVO[a.motivo] || a.motivo }}</span>
                <div class="muted">Regresa el {{ formatFechaCorta(a.regresa) }}</div>
              </div>
            </li>
          </ul>
          <p class="empty" v-else>Plantilla completa hoy.</p>
        </section>

        <section class="card">
          <div class="card__titulo">Celebraciones del mes</div>
          <div class="celebra" v-if="cumpleanos.length || aniversarios.length">
            <div v-if="cumpleanos.length">
              <div class="celebra__grupo"><span v-html="ICONS.pastel"></span> Cumpleaños</div>
              <ul>
                <li v-for="c in cumpleanos" :key="`c${c.id}`">
                  <span class="principal">{{ c.nombre_completo }}</span>
                  <span class="muted">{{ formatFechaCorta(c.fecha).slice(0, 5) }} · cumple {{ c.edad }}</span>
                </li>
              </ul>
            </div>
            <div v-if="aniversarios.length">
              <div class="celebra__grupo"><span v-html="ICONS.medalla"></span> Aniversarios laborales</div>
              <ul>
                <li v-for="a in aniversarios" :key="`a${a.id}`">
                  <span class="principal">{{ a.nombre_completo }}</span>
                  <span class="muted">{{ formatFechaCorta(a.fecha).slice(0, 5) }} · {{ a.anios }} años</span>
                </li>
              </ul>
            </div>
          </div>
          <p class="empty" v-else>Sin celebraciones en los próximos 31 días.</p>
        </section>

        <section class="card">
          <div class="card__titulo">Plantilla por departamento</div>
          <ul class="barras" v-if="resumen.porDepartamento?.length">
            <li v-for="d in resumen.porDepartamento" :key="d.nombre">
              <div class="barra__label">
                <span>{{ d.nombre }}</span>
                <strong>{{ d.n }}</strong>
              </div>
              <div class="barra"><div class="barra__fill" :style="{ width: anchoBarra(d.n) }"></div></div>
            </li>
          </ul>
          <p class="empty" v-else>Aún no hay empleados registrados.</p>
        </section>

        <section class="card card--ancha">
          <div class="card__titulo">Altas y bajas de los últimos 12 meses</div>
          <div class="grafica" v-if="movimiento.length">
            <div class="grafica__col" v-for="m in movimiento" :key="m.mes">
              <div class="grafica__barras">
                <div
                  class="grafica__alta"
                  :style="{ height: alturaBarra(m.altas) }"
                  :title="`${m.altas} alta(s)`"
                ></div>
                <div
                  class="grafica__baja"
                  :style="{ height: alturaBarra(m.bajas) }"
                  :title="`${m.bajas} baja(s)`"
                ></div>
              </div>
              <div class="grafica__mes">{{ etiquetaMes(m.mes) }}</div>
            </div>
          </div>
          <div class="leyenda">
            <span><i class="punto punto--alta"></i> Altas</span>
            <span><i class="punto punto--baja"></i> Bajas</span>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import formats from '../mixin/formats'
import ICONS from '../utils/icons'

const ETIQUETA_MOTIVO = {
  vacaciones: 'Vacaciones',
  incapacidad: 'Incapacidad',
  con_goce: 'Permiso con goce',
  sin_goce: 'Permiso sin goce',
  home_office: 'Home office',
  falta: 'Falta',
  otro: 'Permiso'
}

export default {
  name: 'Dashboard',
  mixins: [formats],
  data() {
    return {
      ICONS,
      ETIQUETA_MOTIVO,
      resumen: {},
      alertas: [],
      ausencias: [],
      cumpleanos: [],
      aniversarios: [],
      movimiento: []
    }
  },
  computed: {
    ...mapGetters(['usuarioActual']),
    primerNombre() {
      return (this.usuarioActual?.nombre || '').split(' ')[0] || ''
    },
    fechaLarga() {
      const f = new Date()
      const texto = f.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      return texto.charAt(0).toUpperCase() + texto.slice(1)
    },
    pendientes() {
      return (this.resumen.vacacionesPendientes || 0) + (this.resumen.permisosPendientes || 0)
    },
    maxDepartamento() {
      return Math.max(1, ...(this.resumen.porDepartamento || []).map((d) => d.n))
    },
    maxMovimiento() {
      return Math.max(1, ...this.movimiento.flatMap((m) => [m.altas, m.bajas]))
    }
  },
  async mounted() {
    const [resumen, alertas, ausencias, celebraciones, movimiento] = await Promise.all([
      window.api.dashboard.resumen(),
      window.api.dashboard.alertas(),
      window.api.dashboard.ausenciasHoy(),
      window.api.dashboard.celebraciones({ dias: 31 }),
      window.api.dashboard.movimientoPlantilla()
    ])
    this.resumen = resumen
    this.alertas = alertas
    this.ausencias = ausencias
    this.cumpleanos = celebraciones.cumpleanos
    this.aniversarios = celebraciones.aniversarios
    this.movimiento = movimiento
  },
  methods: {
    iconoAlerta(tipo) {
      return { documento: 'documento', contrato: 'documento', vacaciones: 'palmera', solicitud: 'ausencias' }[tipo] || 'alerta'
    },
    badgeMotivo(motivo) {
      if (motivo === 'incapacidad') return 'badge--rojo'
      if (motivo === 'vacaciones') return 'badge--verde'
      if (motivo === 'falta' || motivo === 'sin_goce') return 'badge--ambar'
      return 'badge--azul'
    },
    irAEmpleado(alerta) {
      if (alerta.empleado_id) this.$router.push(`/empleados/${alerta.empleado_id}`)
    },
    anchoBarra(n) {
      return `${Math.round((n / this.maxDepartamento) * 100)}%`
    },
    alturaBarra(n) {
      return `${Math.max(3, Math.round((n / this.maxMovimiento) * 100))}%`
    },
    etiquetaMes(mes) {
      const [, m] = mes.split('-')
      return ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][Number(m) - 1]
    }
  }
}
</script>

<style scoped>
.scroll {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding-right: 4px;
}

.kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.kpi {
  background: var(--surface-2);
  border-radius: var(--radius-sm);
  padding: 14px 16px;
}

.kpi--accion {
  background: var(--primary-soft);
  cursor: pointer;
}

.kpi--accion:hover {
  background: #E8E4FD;
}

.kpi__valor {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.6px;
  color: var(--text-1);
}

.kpi__label {
  font-size: 11.5px;
  color: var(--text-2);
  margin-top: 2px;
}

.columnas {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(330px, 1fr));
  gap: 14px;
  align-items: start;
}

.card--ancha {
  grid-column: 1 / -1;
}

.alertas,
.ausentes,
.barras,
.celebra ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.alerta {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 9px 11px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  cursor: pointer;
  border-left: 3px solid var(--text-3);
}

.alerta:hover {
  background: var(--primary-soft);
}

.alerta--alta { border-left-color: var(--red); }
.alerta--media { border-left-color: var(--amber); }
.alerta--baja { border-left-color: var(--blue); }

.alerta__icono {
  color: var(--text-2);
  flex-shrink: 0;
  margin-top: 1px;
}

.alerta__titulo {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-1);
}

.alerta__detalle {
  font-size: 11.5px;
  color: var(--text-2);
}

.ausentes li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid #F0EEFA;
}

.ausente__nombre {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}

.ausente__derecha {
  text-align: right;
  display: flex;
  flex-direction: column;
  gap: 3px;
  align-items: flex-end;
}

.celebra {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.celebra__grupo {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--primary);
  margin-bottom: 7px;
}

.celebra li {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 12.5px;
}

.barra__label {
  display: flex;
  justify-content: space-between;
  font-size: 12.5px;
  color: var(--text-2);
  margin-bottom: 4px;
}

.barra {
  height: 7px;
  border-radius: 6px;
  background: var(--surface-2);
  overflow: hidden;
}

.barra__fill {
  height: 100%;
  border-radius: 6px;
  background: var(--primary);
}

.grafica {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  height: 120px;
  padding-top: 6px;
}

.grafica__col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  height: 100%;
}

.grafica__barras {
  flex: 1;
  width: 100%;
  display: flex;
  gap: 3px;
  align-items: flex-end;
  justify-content: center;
}

.grafica__alta,
.grafica__baja {
  width: 42%;
  border-radius: 4px 4px 0 0;
  min-height: 3px;
}

.grafica__alta { background: var(--primary); }
.grafica__baja { background: var(--red); }

.grafica__mes {
  font-size: 10.5px;
  color: var(--text-3);
  font-weight: 700;
}

.leyenda {
  display: flex;
  gap: 16px;
  margin-top: 10px;
  font-size: 11.5px;
  color: var(--text-2);
}

.leyenda span {
  display: flex;
  align-items: center;
  gap: 6px;
}

.punto {
  width: 9px;
  height: 9px;
  border-radius: 3px;
  display: inline-block;
}

.punto--alta { background: var(--primary); }
.punto--baja { background: var(--red); }
</style>
