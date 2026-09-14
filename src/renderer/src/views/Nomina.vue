<template>
  <div class="page">
    <div class="page__head">
      <div>
        <div class="page__title">Nómina</div>
        <div class="page__subtitle">
          Percepciones, deducciones y recibos por periodo
        </div>
      </div>
      <div class="page__acciones">
        <button class="btn-primary" @click="abrirPeriodo">+ Nuevo periodo</button>
      </div>
    </div>

    <p class="nota">
      El ISR usa la tarifa del artículo 96 y el IMSS las cuotas obrero-patronales a cargo del
      trabajador. Verifica en Ajustes que la tarifa, la UMA y el subsidio estén vigentes antes de timbrar.
    </p>

    <div class="cuerpo">
      <aside class="periodos">
        <div
          v-for="p in periodos"
          :key="p.id"
          class="periodo"
          :class="{ 'periodo--activo': periodo?.id === p.id }"
          @click="seleccionar(p)"
        >
          <div class="periodo__nombre">{{ p.nombre }}</div>
          <div class="muted">{{ formatFechaCorta(p.fecha_inicio) }} — {{ formatFechaCorta(p.fecha_fin) }}</div>
          <div class="periodo__pie">
            <span :class="['badge', p.estatus === 'cerrado' ? 'badge--verde' : 'badge--ambar']">
              {{ p.estatus === 'cerrado' ? 'Cerrado' : 'Abierto' }}
            </span>
            <b>{{ formatMoney(p.total_neto) }}</b>
          </div>
        </div>
        <p class="empty" v-if="periodos.length === 0">Crea el primer periodo para empezar</p>
      </aside>

      <section class="detalle" v-if="periodo">
        <div class="detalle__head">
          <div>
            <div class="detalle__titulo">{{ periodo.nombre }}</div>
            <div class="muted">
              {{ periodo.dias }} días · pago el {{ formatFechaCorta(periodo.fecha_pago) }} ·
              {{ recibos.length }} empleado(s)
            </div>
          </div>
          <div class="page__acciones">
            <template v-if="periodo.estatus === 'abierto'">
              <button class="btn-ghost btn-sm" @click="generar">Generar / actualizar</button>
              <button class="btn-ghost btn-sm" @click="sugerirAguinaldo">Aguinaldo</button>
              <button class="btn-secondary btn-sm" @click="cerrar">Cerrar periodo</button>
              <button class="icon-btn icon-btn--danger" title="Eliminar periodo" @click="eliminar">✕</button>
            </template>
            <button class="btn-ghost btn-sm" v-else @click="reabrir">Reabrir</button>
          </div>
        </div>

        <div class="totales">
          <div><span>Percepciones</span><b>{{ formatMoney(periodo.total_percepciones) }}</b></div>
          <div><span>Deducciones</span><b>{{ formatMoney(periodo.total_deducciones) }}</b></div>
          <div class="totales__neto"><span>Neto a pagar</span><b>{{ formatMoney(periodo.total_neto) }}</b></div>
        </div>

        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>Empleado</th>
                <th class="num">Días</th>
                <th class="num">Sueldo</th>
                <th class="num">Extras</th>
                <th class="num">Percepciones</th>
                <th class="num">ISR</th>
                <th class="num">IMSS</th>
                <th class="num">Deducciones</th>
                <th class="num">Neto</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in recibos" :key="r.id">
                <td>
                  <div class="principal clickable" @click="$router.push(`/empleados/${r.empleado_id}`)">{{ r.empleado }}</div>
                  <div class="muted">{{ r.puesto || 'Sin puesto' }}</div>
                </td>
                <td class="num">
                  {{ r.dias_trabajados }}
                  <div class="muted" v-if="r.dias_falta || r.dias_incapacidad">
                    -{{ r.dias_falta + r.dias_incapacidad }}
                  </div>
                </td>
                <td class="num">{{ formatMoney(r.sueldo) }}</td>
                <td class="num">{{ formatMoney(r.monto_horas_extra + r.prima_vacacional + r.aguinaldo + r.bonos + r.otras_percepciones) }}</td>
                <td class="num">{{ formatMoney(r.total_percepciones) }}</td>
                <td class="num">{{ formatMoney(r.isr - r.subsidio) }}</td>
                <td class="num">{{ formatMoney(r.imss) }}</td>
                <td class="num">{{ formatMoney(r.total_deducciones) }}</td>
                <td class="num"><b>{{ formatMoney(r.neto) }}</b></td>
                <td>
                  <div class="acciones">
                    <button class="icon-btn" title="Editar importes" v-if="periodo.estatus === 'abierto'" @click="editar(r)">✎</button>
                    <button class="icon-btn" title="Recibo en PDF" @click="imprimir(r)">⇩</button>
                  </div>
                </td>
              </tr>
              <tr v-if="recibos.length === 0">
                <td colspan="10" class="empty">
                  Aún no hay recibos. Usa "Generar / actualizar" para armarlos con la plantilla activa.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="detalle" v-else>
        <p class="empty">Selecciona un periodo de la izquierda</p>
      </section>
    </div>

    <!-- Nuevo periodo -->
    <div class="modal-backdrop" v-if="formPeriodo" @click.self="formPeriodo = null">
      <div class="modal">
        <div class="modal__titulo">Nuevo periodo de nómina</div>
        <div class="modal__sub">Los periodos no se pueden empalmar entre sí.</div>

        <div class="campo">
          <label>Nombre</label>
          <input type="text" v-model="formPeriodo.nombre" placeholder="1ª quincena de marzo 2026" />
        </div>
        <div class="campos">
          <div class="campo">
            <label>Tipo</label>
            <select v-model="formPeriodo.tipo" @change="aplicarTipo">
              <option value="semanal">Semanal</option>
              <option value="catorcenal">Catorcenal</option>
              <option value="quincenal">Quincenal</option>
              <option value="mensual">Mensual</option>
            </select>
          </div>
          <div class="campo">
            <label>Días a pagar</label>
            <input type="number" min="1" step="0.5" v-model.number="formPeriodo.dias" />
          </div>
        </div>
        <div class="campos">
          <div class="campo">
            <label>Del</label>
            <input type="date" v-model="formPeriodo.fecha_inicio" />
          </div>
          <div class="campo">
            <label>Al</label>
            <input type="date" v-model="formPeriodo.fecha_fin" />
          </div>
          <div class="campo">
            <label>Fecha de pago</label>
            <input type="date" v-model="formPeriodo.fecha_pago" />
          </div>
        </div>

        <p class="error" v-if="error">{{ error }}</p>

        <div class="modal__acciones">
          <button class="btn-ghost" @click="formPeriodo = null">Cancelar</button>
          <button class="btn-primary" @click="guardarPeriodo">Crear</button>
        </div>
      </div>
    </div>

    <!-- Editar recibo -->
    <div class="modal-backdrop" v-if="reciboEditado" @click.self="reciboEditado = null">
      <div class="modal modal--ancho">
        <div class="modal__titulo">{{ reciboEditado.empleado }}</div>
        <div class="modal__sub">
          Los importes que cambies aquí se conservan al volver a generar el periodo.
        </div>

        <div class="columnas">
          <div>
            <div class="card__titulo">Percepciones</div>
            <div class="campo">
              <label>Días a pagar</label>
              <input type="number" min="0" step="0.5" v-model.number="reciboEditado.dias_trabajados" />
            </div>
            <div class="campo">
              <label>Horas extra</label>
              <input type="number" min="0" step="0.5" v-model.number="reciboEditado.horas_extra" />
            </div>
            <div class="campo">
              <label>Prima vacacional</label>
              <input type="number" min="0" step="0.01" v-model.number="reciboEditado.prima_vacacional" />
            </div>
            <div class="campo">
              <label>Aguinaldo</label>
              <input type="number" min="0" step="0.01" v-model.number="reciboEditado.aguinaldo" />
            </div>
            <div class="campo">
              <label>Bonos</label>
              <input type="number" min="0" step="0.01" v-model.number="reciboEditado.bonos" />
            </div>
            <div class="campo">
              <label>Otras percepciones</label>
              <input type="number" min="0" step="0.01" v-model.number="reciboEditado.otras_percepciones" />
            </div>
          </div>

          <div>
            <div class="card__titulo">Deducciones e incidencias</div>
            <div class="campo">
              <label>Días de falta</label>
              <input type="number" min="0" step="0.5" v-model.number="reciboEditado.dias_falta" />
            </div>
            <div class="campo">
              <label>Días de incapacidad</label>
              <input type="number" min="0" step="0.5" v-model.number="reciboEditado.dias_incapacidad" />
            </div>
            <div class="campo">
              <label>Infonavit</label>
              <input type="number" min="0" step="0.01" v-model.number="reciboEditado.infonavit" />
            </div>
            <div class="campo">
              <label>Préstamos</label>
              <input type="number" min="0" step="0.01" v-model.number="reciboEditado.prestamos" />
            </div>
            <div class="campo">
              <label>Otras deducciones</label>
              <input type="number" min="0" step="0.01" v-model.number="reciboEditado.otras_deducciones" />
            </div>
            <div class="campo">
              <label>Notas</label>
              <input type="text" v-model="reciboEditado.notas" />
            </div>
          </div>
        </div>

        <div class="card card--plano calculado">
          <div><span>ISR retenido</span><b>{{ formatMoney(reciboEditado.isr - reciboEditado.subsidio) }}</b></div>
          <div><span>IMSS</span><b>{{ formatMoney(reciboEditado.imss) }}</b></div>
          <div><span>Descuento por faltas</span><b>{{ formatMoney(reciboEditado.descuento_faltas) }}</b></div>
          <div class="calculado__neto"><span>Neto</span><b>{{ formatMoney(reciboEditado.neto) }}</b></div>
        </div>
        <p class="muted">Estos tres se recalculan solos al guardar.</p>

        <p class="error" v-if="error">{{ error }}</p>

        <div class="modal__acciones">
          <button class="btn-ghost" @click="reciboEditado = null">Cancelar</button>
          <button class="btn-primary" @click="guardarRecibo">Guardar y recalcular</button>
        </div>
      </div>
    </div>

    <!-- Aguinaldo -->
    <div class="modal-backdrop" v-if="aguinaldos" @click.self="aguinaldos = null">
      <div class="modal modal--ancho">
        <div class="modal__titulo">Aguinaldo proporcional</div>
        <div class="modal__sub">
          Calculado al 31 de diciembre con los días de aguinaldo de Ajustes. Ajusta los montos
          que necesites antes de aplicar.
        </div>

        <table class="data-table">
          <thead>
            <tr><th>Empleado</th><th class="num">Días trabajados</th><th class="num">Días de aguinaldo</th><th class="num">Monto</th></tr>
          </thead>
          <tbody>
            <tr v-for="s in aguinaldos" :key="s.recibo_id">
              <td class="principal">{{ s.empleado }}</td>
              <td class="num">{{ s.diasTrabajados }}</td>
              <td class="num">{{ s.dias }}</td>
              <td class="num"><input type="number" min="0" step="0.01" v-model.number="s.monto" /></td>
            </tr>
          </tbody>
        </table>

        <div class="modal__acciones">
          <button class="btn-ghost" @click="aguinaldos = null">Cancelar</button>
          <button class="btn-primary" @click="aplicarAguinaldo">Aplicar a los recibos</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import formats from '../mixin/formats'

const DIAS_POR_TIPO = { semanal: 7, catorcenal: 14, quincenal: 15, mensual: 30 }

export default {
  name: 'Nomina',
  mixins: [formats],
  data() {
    return {
      periodos: [],
      periodo: null,
      recibos: [],
      formPeriodo: null,
      reciboEditado: null,
      aguinaldos: null,
      error: ''
    }
  },
  computed: {
    ...mapGetters(['usuarioActual', 'empresa'])
  },
  async mounted() {
    await this.cargarPeriodos()
    if (this.periodos.length) await this.seleccionar(this.periodos[0])
  },
  methods: {
    async cargarPeriodos() {
      this.periodos = await window.api.nomina.periodos()
    },
    async seleccionar(p) {
      this.periodo = p
      this.recibos = await window.api.nomina.recibos(p.id)
    },
    async refrescar() {
      await this.cargarPeriodos()
      const actualizado = this.periodos.find((p) => p.id === this.periodo?.id)
      if (actualizado) await this.seleccionar(actualizado)
    },

    abrirPeriodo() {
      this.error = ''
      const hoy = this.hoyIso()
      const [anio, mes] = hoy.split('-')
      this.formPeriodo = {
        nombre: '',
        tipo: this.empresa?.periodo_nomina || 'quincenal',
        dias: DIAS_POR_TIPO[this.empresa?.periodo_nomina || 'quincenal'],
        fecha_inicio: `${anio}-${mes}-01`,
        fecha_fin: `${anio}-${mes}-15`,
        fecha_pago: `${anio}-${mes}-15`
      }
    },
    aplicarTipo() {
      this.formPeriodo.dias = DIAS_POR_TIPO[this.formPeriodo.tipo]
    },
    async guardarPeriodo() {
      this.error = ''
      const res = await window.api.nomina.crearPeriodo({
        ...this.formPeriodo,
        usuario_id: this.usuarioActual?.id
      })
      if (!res.ok) {
        this.error = res.mensaje
        return
      }
      this.formPeriodo = null
      await this.cargarPeriodos()
      const nuevo = this.periodos.find((p) => p.id === res.id)
      if (nuevo) await this.seleccionar(nuevo)
      this.$store.dispatch('notificar', { mensaje: 'Periodo creado' })
    },

    async generar() {
      const res = await window.api.nomina.generar({ periodo_id: this.periodo.id })
      if (!res.ok) {
        this.$store.dispatch('notificar', { mensaje: res.mensaje, tipo: 'error' })
        return
      }
      await this.refrescar()
      this.$store.dispatch('notificar', { mensaje: `Nómina generada para ${res.empleados} empleado(s)` })
    },
    async cerrar() {
      if (!confirm('Al cerrar el periodo ya no se podrán editar los recibos. ¿Continuar?')) return
      const res = await window.api.nomina.cerrarPeriodo(this.periodo.id)
      if (!res.ok) {
        this.$store.dispatch('notificar', { mensaje: res.mensaje, tipo: 'error' })
        return
      }
      await this.refrescar()
    },
    async reabrir() {
      await window.api.nomina.reabrirPeriodo(this.periodo.id)
      await this.refrescar()
    },
    async eliminar() {
      if (!confirm(`¿Eliminar el periodo "${this.periodo.nombre}" y todos sus recibos?`)) return
      const res = await window.api.nomina.eliminarPeriodo(this.periodo.id)
      if (!res.ok) {
        this.$store.dispatch('notificar', { mensaje: res.mensaje, tipo: 'error' })
        return
      }
      this.periodo = null
      this.recibos = []
      await this.cargarPeriodos()
    },

    editar(recibo) {
      this.error = ''
      this.reciboEditado = { ...recibo }
    },
    async guardarRecibo() {
      this.error = ''
      const res = await window.api.nomina.actualizarRecibo({
        id: this.reciboEditado.id,
        data: this.reciboEditado
      })
      if (!res.ok) {
        this.error = res.mensaje
        return
      }
      this.reciboEditado = null
      await this.refrescar()
    },
    async imprimir(recibo) {
      const res = await window.api.nomina.imprimirRecibo(recibo.id)
      if (res.ok) this.$store.dispatch('notificar', { mensaje: 'Recibo guardado en PDF' })
      else if (res.mensaje) this.$store.dispatch('notificar', { mensaje: res.mensaje, tipo: 'error' })
    },

    async sugerirAguinaldo() {
      const res = await window.api.nomina.calcularAguinaldo(this.periodo.id)
      if (!res.ok) {
        this.$store.dispatch('notificar', { mensaje: res.mensaje, tipo: 'error' })
        return
      }
      if (res.sugerencias.length === 0) {
        this.$store.dispatch('notificar', { mensaje: 'Genera la nómina antes de calcular el aguinaldo', tipo: 'error' })
        return
      }
      this.aguinaldos = res.sugerencias
    },
    async aplicarAguinaldo() {
      const res = await window.api.nomina.aplicarAguinaldo({
        periodo_id: this.periodo.id,
        sugerencias: this.aguinaldos
      })
      if (!res.ok) {
        this.$store.dispatch('notificar', { mensaje: res.mensaje, tipo: 'error' })
        return
      }
      this.aguinaldos = null
      await this.refrescar()
      this.$store.dispatch('notificar', { mensaje: 'Aguinaldo aplicado' })
    }
  }
}
</script>

<style scoped>
.cuerpo {
  flex: 1;
  display: grid;
  grid-template-columns: 236px 1fr;
  gap: 16px;
  min-height: 0;
}

.periodos {
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding-right: 4px;
}

.periodo {
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 11px 13px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.periodo:hover {
  border-color: var(--primary-light);
}

.periodo--activo {
  border-color: var(--primary);
  background: var(--primary-soft);
}

.periodo__nombre {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-1);
}

.periodo__pie {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 7px;
  font-size: 12.5px;
}

.detalle {
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: 12px;
}

.detalle__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.detalle__titulo {
  font-size: 16px;
  font-weight: 800;
}

.totales {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.totales > div {
  background: var(--surface-2);
  border-radius: var(--radius-sm);
  padding: 11px 14px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.totales span {
  font-size: 11.5px;
  color: var(--text-2);
}

.totales b {
  font-size: 17px;
  font-weight: 800;
  letter-spacing: -0.4px;
}

.totales__neto {
  background: var(--primary-soft) !important;
  color: var(--primary-dark);
}

.columnas {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.calculado {
  margin-top: 16px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.calculado > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.calculado span {
  font-size: 11px;
  color: var(--text-2);
}

.calculado b {
  font-size: 14px;
}

.calculado__neto b {
  color: var(--primary);
  font-size: 16px;
}

.data-table input {
  padding: 5px 8px;
  font-size: 12.5px;
  text-align: right;
}
</style>
