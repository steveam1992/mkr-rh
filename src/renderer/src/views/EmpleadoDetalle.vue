<template>
  <div class="page" v-if="empleado">
    <div class="cabecera">
      <button class="icon-btn" title="Volver" @click="$router.push('/empleados')">‹</button>
      <div class="avatar">
        <img v-if="empleado.foto" :src="empleado.foto" alt="" />
        <span v-else>{{ iniciales(empleado.nombre_completo) }}</span>
      </div>
      <div class="cabecera__datos">
        <div class="page__title">{{ empleado.nombre_completo }}</div>
        <div class="page__subtitle">
          {{ empleado.puesto || 'Sin puesto' }}
          <span v-if="empleado.departamento"> · {{ empleado.departamento }}</span>
          <span v-if="empleado.numero_empleado"> · {{ empleado.numero_empleado }}</span>
        </div>
        <div class="cabecera__badges">
          <span class="badge" :class="empleado.estatus === 'activo' ? 'badge--verde' : 'badge--rojo'">
            {{ empleado.estatus === 'activo' ? 'Activo' : 'Dado de baja' }}
          </span>
          <span class="badge badge--morado">{{ empleado.antiguedad.texto }} de antigüedad</span>
          <span class="badge" v-if="empleado.edad">{{ empleado.edad }} años</span>
          <span class="badge badge--ambar" v-if="alertaContrato">{{ alertaContrato }}</span>
        </div>
      </div>
      <div class="page__acciones">
        <button class="btn-ghost" @click="editar()">Editar</button>
        <button class="btn-secondary" v-if="empleado.estatus === 'baja'" @click="abrirReingreso">Reingresar</button>
        <button class="btn-danger" v-else @click="abrirBaja">Dar de baja</button>
      </div>
    </div>

    <div class="tabs">
      <button
        v-for="t in tabs"
        :key="t.clave"
        class="tab"
        :class="{ 'tab--activa': tab === t.clave }"
        @click="tab = t.clave"
      >
        {{ t.label }}<span class="conteo" v-if="t.conteo">{{ t.conteo }}</span>
      </button>
    </div>

    <div class="contenido">
      <!-- Resumen -->
      <div v-if="tab === 'resumen'" class="rejilla">
        <section class="card">
          <div class="card__titulo">Vacaciones</div>
          <div class="saldo">
            <div class="saldo__valor">{{ empleado.vacaciones.disponibles }}</div>
            <div class="saldo__label">días disponibles</div>
          </div>
          <ul class="lista-datos">
            <li><span>Derecho por años cumplidos</span><b>{{ empleado.vacaciones.generados }}</b></li>
            <li><span>Proporcional del año en curso</span><b>{{ empleado.vacaciones.proporcional }}</b></li>
            <li><span>Días tomados</span><b>{{ empleado.vacaciones.tomados }}</b></li>
            <li v-if="empleado.vacaciones.ajustes"><span>Ajustes manuales</span><b>{{ empleado.vacaciones.ajustes }}</b></li>
            <li><span>Le tocan este año</span><b>{{ empleado.vacaciones.diasDelAnioEnCurso }} días</b></li>
          </ul>
          <router-link to="/vacaciones" class="btn-secondary btn-sm bloque">Registrar vacaciones</router-link>
        </section>

        <section class="card">
          <div class="card__cabecera">
            <div class="card__titulo">Puesto y contrato</div>
            <button class="icon-btn" title="Editar puesto y contrato" @click="editar('puesto')">✎</button>
          </div>
          <ul class="lista-datos">
            <li class="editable" @click="editar('puesto')" title="Clic para corregir la fecha de ingreso">
              <span>Fecha de ingreso</span><b>{{ formatFecha(empleado.fecha_ingreso) }}</b>
            </li>
            <li><span>Tipo de contrato</span><b>{{ ETIQUETA_CONTRATO[empleado.tipo_contrato] }}</b></li>
            <li v-if="empleado.fecha_fin_contrato"><span>Termina el</span><b>{{ formatFecha(empleado.fecha_fin_contrato) }}</b></li>
            <li><span>Jefe directo</span><b>{{ empleado.jefe || '—' }}</b></li>
            <li><span>Jornada</span><b>{{ empleado.tipo_jornada }} · {{ empleado.hora_entrada || '—' }} a {{ empleado.hora_salida || '—' }}</b></li>
            <li><span>Descansos</span><b>{{ textoDescansos }}</b></li>
          </ul>
        </section>

        <section class="card">
          <div class="card__titulo">Sueldo</div>
          <ul class="lista-datos">
            <li><span>Salario diario</span><b>{{ formatMoney(empleado.salario_diario) }}</b></li>
            <li><span>Salario mensual</span><b>{{ formatMoney(empleado.salario_mensual) }}</b></li>
            <li><span>Salario diario integrado</span><b>{{ formatMoney(empleado.salario_diario_integrado) }}</b></li>
            <li><span>Banco</span><b>{{ empleado.banco || '—' }}</b></li>
            <li><span>CLABE / cuenta</span><b>{{ empleado.clabe || '—' }}</b></li>
          </ul>
        </section>

        <section class="card">
          <div class="card__titulo">Datos personales</div>
          <ul class="lista-datos">
            <li><span>Fecha de nacimiento</span><b>{{ formatFecha(empleado.fecha_nacimiento) }}</b></li>
            <li><span>CURP</span><b>{{ empleado.curp || '—' }}</b></li>
            <li><span>RFC</span><b>{{ empleado.rfc || '—' }}</b></li>
            <li><span>NSS</span><b>{{ empleado.nss || '—' }}</b></li>
            <li><span>Estado civil</span><b>{{ empleado.estado_civil || '—' }}</b></li>
          </ul>
        </section>

        <section class="card">
          <div class="card__titulo">Contacto</div>
          <ul class="lista-datos">
            <li><span>Teléfono</span><b>{{ empleado.telefono || '—' }}</b></li>
            <li><span>Correo</span><b>{{ empleado.correo || '—' }}</b></li>
            <li><span>Dirección</span><b>{{ direccionCompleta }}</b></li>
            <li><span>Emergencia</span><b>{{ empleado.contacto_emergencia || '—' }}</b></li>
            <li><span>Tel. emergencia</span><b>{{ empleado.telefono_emergencia || '—' }}</b></li>
          </ul>
        </section>

        <section class="card" v-if="empleado.baja">
          <div class="card__titulo">Baja</div>
          <ul class="lista-datos">
            <li><span>Fecha</span><b>{{ formatFecha(empleado.baja.fecha_baja) }}</b></li>
            <li><span>Motivo</span><b>{{ ETIQUETA_BAJA[empleado.baja.motivo] || empleado.baja.motivo }}</b></li>
            <li><span>Finiquito pagado</span><b>{{ formatMoney(empleado.baja.total_finiquito) }}</b></li>
          </ul>
          <p class="muted" v-if="empleado.baja.descripcion">{{ empleado.baja.descripcion }}</p>
        </section>

        <section class="card" v-if="empleado.notas">
          <div class="card__titulo">Notas internas</div>
          <p class="notas">{{ empleado.notas }}</p>
        </section>
      </div>

      <!-- Documentos -->
      <div v-else-if="tab === 'documentos'" class="panel">
        <div class="toolbar">
          <button class="btn-primary" @click="abrirDocumento()">+ Agregar documento</button>
          <button class="btn-ghost" @click="abrirCarpeta">Abrir carpeta del expediente</button>
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th>Documento</th>
              <th>Tipo</th>
              <th>Emisión</th>
              <th>Vencimiento</th>
              <th>Tamaño</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in documentos" :key="d.id">
              <td>
                <div class="principal clickable" @click="abrirArchivo(d)">{{ d.nombre }}</div>
                <div class="muted" v-if="d.notas">{{ d.notas }}</div>
                <div class="muted" v-if="!d.existe" style="color: var(--red)">Archivo no encontrado</div>
              </td>
              <td>{{ ETIQUETA_DOC[d.tipo] || d.tipo }}</td>
              <td>{{ formatFechaCorta(d.fecha_emision) }}</td>
              <td>
                <span v-if="!d.fecha_vencimiento">—</span>
                <span v-else :class="['badge', badgeVencimiento(d.fecha_vencimiento)]">
                  {{ formatFechaCorta(d.fecha_vencimiento) }}
                </span>
              </td>
              <td>{{ tamano(d.tamano) }}</td>
              <td>
                <div class="acciones">
                  <button class="icon-btn" title="Abrir" @click="abrirArchivo(d)">↗</button>
                  <button class="icon-btn" title="Guardar copia" @click="exportarDoc(d)">⇩</button>
                  <button class="icon-btn" title="Editar datos" @click="abrirDocumento(d)">✎</button>
                  <button class="icon-btn icon-btn--danger" title="Eliminar" @click="eliminarDoc(d)">✕</button>
                </div>
              </td>
            </tr>
            <tr v-if="documentos.length === 0">
              <td colspan="6" class="empty">El expediente está vacío. Agrega el contrato, la INE, la CURP…</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Percepciones y deducciones -->
      <ConceptosEmpleado
        v-else-if="tab === 'conceptos'"
        :empleado-id="id"
        @cambio="cargarConceptos"
      />

      <!-- Ausencias -->
      <div v-else-if="tab === 'ausencias'" class="panel">
        <section class="card">
          <div class="card__titulo">Vacaciones</div>
          <table class="data-table">
            <thead><tr><th>Periodo</th><th class="num">Días</th><th>Estatus</th><th>Motivo</th></tr></thead>
            <tbody>
              <tr v-for="v in vacaciones" :key="v.id">
                <td class="principal">{{ formatFechaCorta(v.fecha_inicio) }} — {{ formatFechaCorta(v.fecha_fin) }}</td>
                <td class="num">{{ v.dias }}</td>
                <td><span :class="['badge', badgeEstatusVac(v.estatus)]">{{ v.estatus }}</span></td>
                <td>{{ v.motivo || '—' }}</td>
              </tr>
              <tr v-if="vacaciones.length === 0"><td colspan="4" class="empty">Sin vacaciones registradas</td></tr>
            </tbody>
          </table>
        </section>

        <section class="card">
          <div class="card__titulo">Incapacidades</div>
          <table class="data-table">
            <thead><tr><th>Periodo</th><th>Folio</th><th>Tipo</th><th class="num">Días</th><th class="num">% pago</th></tr></thead>
            <tbody>
              <tr v-for="i in incapacidades" :key="i.id">
                <td class="principal">{{ formatFechaCorta(i.fecha_inicio) }} — {{ formatFechaCorta(i.fecha_fin) }}</td>
                <td>{{ i.folio || '—' }}</td>
                <td>{{ ETIQUETA_INCAPACIDAD[i.tipo] || i.tipo }}</td>
                <td class="num">{{ i.dias }}</td>
                <td class="num">{{ i.porcentaje_pago }}%</td>
              </tr>
              <tr v-if="incapacidades.length === 0"><td colspan="5" class="empty">Sin incapacidades registradas</td></tr>
            </tbody>
          </table>
        </section>

        <section class="card">
          <div class="card__titulo">Permisos y faltas</div>
          <table class="data-table">
            <thead><tr><th>Fecha</th><th>Tipo</th><th class="num">Días</th><th>Estatus</th><th>Motivo</th></tr></thead>
            <tbody>
              <tr v-for="p in permisos" :key="p.id">
                <td class="principal">{{ formatFechaCorta(p.fecha_inicio) }}<span v-if="p.fecha_fin !== p.fecha_inicio"> — {{ formatFechaCorta(p.fecha_fin) }}</span></td>
                <td>{{ ETIQUETA_PERMISO[p.tipo] || p.tipo }}</td>
                <td class="num">{{ p.tipo === 'retardo' ? `${p.horas} h` : p.dias }}</td>
                <td><span class="badge">{{ p.estatus }}</span></td>
                <td>{{ p.motivo || '—' }}</td>
              </tr>
              <tr v-if="permisos.length === 0"><td colspan="5" class="empty">Sin permisos ni faltas registradas</td></tr>
            </tbody>
          </table>
        </section>
      </div>

      <!-- Historial -->
      <div v-else class="panel">
        <ul class="linea">
          <li v-for="m in movimientos" :key="m.id">
            <div class="linea__punto"></div>
            <div>
              <div class="principal">{{ ETIQUETA_MOVIMIENTO[m.tipo] || m.tipo }}</div>
              <div class="muted">{{ formatFecha(m.fecha) }} · {{ m.usuario || 'Sistema' }}</div>
              <div class="linea__cambio" v-if="m.valor_anterior || m.valor_nuevo">
                <span v-if="m.valor_anterior">{{ m.valor_anterior }} →</span>
                <b>{{ m.valor_nuevo }}</b>
              </div>
              <div class="muted" v-if="m.nota">{{ m.nota }}</div>
            </div>
          </li>
          <li v-if="movimientos.length === 0"><p class="empty">Sin movimientos registrados</p></li>
        </ul>
      </div>
    </div>

    <EmpleadoForm
      v-if="mostrarForm"
      :empleado="empleado"
      :seccion-inicial="seccionForm"
      @cerrar="mostrarForm = false"
      @guardado="alGuardar"
    />

    <!-- Documento -->
    <div class="modal-backdrop" v-if="docForm" @click.self="docForm = null">
      <div class="modal">
        <div class="modal__titulo">{{ docForm.id ? 'Editar documento' : 'Agregar documento' }}</div>
        <div class="modal__sub">
          {{ docForm.id ? 'Solo se modifican los datos; el archivo se conserva.' : 'Se guardará una copia del archivo dentro del expediente.' }}
        </div>

        <div class="campo">
          <label>Tipo</label>
          <select v-model="docForm.tipo">
            <option v-for="(label, clave) in ETIQUETA_DOC" :key="clave" :value="clave">{{ label }}</option>
          </select>
        </div>
        <div class="campo">
          <label>Nombre</label>
          <input type="text" v-model="docForm.nombre" placeholder="Contrato individual de trabajo" />
        </div>
        <div class="campos">
          <div class="campo">
            <label>Fecha de emisión</label>
            <input type="date" v-model="docForm.fecha_emision" />
          </div>
          <div class="campo">
            <label>Vence el (opcional)</label>
            <input type="date" v-model="docForm.fecha_vencimiento" />
          </div>
        </div>
        <div class="campo">
          <label>Notas</label>
          <input type="text" v-model="docForm.notas" />
        </div>

        <p class="error" v-if="errorDoc">{{ errorDoc }}</p>

        <div class="modal__acciones">
          <button class="btn-ghost" @click="docForm = null">Cancelar</button>
          <button class="btn-primary" @click="guardarDocumento">
            {{ docForm.id ? 'Guardar' : 'Seleccionar archivo y guardar' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Baja -->
    <div class="modal-backdrop" v-if="baja" @click.self="baja = null">
      <div class="modal modal--ancho">
        <div class="modal__titulo">Dar de baja a {{ empleado.nombre_completo }}</div>
        <div class="modal__sub">
          El expediente se conserva completo; el empleado deja de contar en la plantilla activa.
        </div>

        <div class="campos">
          <div class="campo">
            <label>Fecha de baja</label>
            <input type="date" v-model="baja.fecha_baja" @change="calcularFiniquito" />
          </div>
          <div class="campo">
            <label>Motivo</label>
            <select v-model="baja.motivo">
              <option v-for="(label, clave) in ETIQUETA_BAJA" :key="clave" :value="clave">{{ label }}</option>
            </select>
          </div>
          <div class="campo">
            <label>Días de salario pendientes</label>
            <input type="number" min="0" step="0.5" v-model.number="baja.dias_salarios" @change="calcularFiniquito" />
          </div>
        </div>

        <div class="card card--plano finiquito">
          <div class="card__titulo">Finiquito</div>
          <div class="campos">
            <div class="campo">
              <label>Días de vacaciones</label>
              <input type="number" step="0.01" v-model.number="baja.dias_vacaciones" @input="recalcularVacaciones" />
            </div>
            <div class="campo">
              <label>Vacaciones</label>
              <input type="number" step="0.01" v-model.number="baja.monto_vacaciones" />
            </div>
            <div class="campo">
              <label>Prima vacacional</label>
              <input type="number" step="0.01" v-model.number="baja.monto_prima_vacacional" />
            </div>
            <div class="campo">
              <label>Aguinaldo proporcional</label>
              <input type="number" step="0.01" v-model.number="baja.monto_aguinaldo" />
            </div>
            <div class="campo">
              <label>Salarios pendientes</label>
              <input type="number" step="0.01" v-model.number="baja.monto_salarios" />
            </div>
            <div class="campo">
              <label>Otras percepciones</label>
              <input type="number" step="0.01" v-model.number="baja.otras_percepciones" />
            </div>
            <div class="campo">
              <label>Deducciones</label>
              <input type="number" step="0.01" v-model.number="baja.deducciones" />
            </div>
          </div>
          <p class="muted">
            La indemnización por despido injustificado (3 meses + 20 días por año) va en
            "otras percepciones": depende de cómo se dé la separación.
          </p>
          <div class="total">
            <span>Total a pagar</span>
            <b>{{ formatMoney(totalFiniquito) }}</b>
          </div>
        </div>

        <div class="campo">
          <label>Descripción / observaciones</label>
          <textarea v-model="baja.descripcion"></textarea>
        </div>

        <p class="error" v-if="errorBaja">{{ errorBaja }}</p>

        <div class="modal__acciones">
          <button class="btn-ghost" @click="baja = null">Cancelar</button>
          <button class="btn-danger" @click="confirmarBaja">Confirmar baja</button>
        </div>
      </div>
    </div>

    <!-- Reingreso -->
    <div class="modal-backdrop" v-if="reingreso" @click.self="reingreso = null">
      <div class="modal">
        <div class="modal__titulo">Reingreso</div>
        <div class="modal__sub">
          La antigüedad y el derecho a vacaciones se recalculan desde la nueva fecha de ingreso.
        </div>
        <div class="campo">
          <label>Fecha de reingreso</label>
          <input type="date" v-model="reingreso.fecha_ingreso" />
        </div>
        <p class="error" v-if="errorBaja">{{ errorBaja }}</p>
        <div class="modal__acciones">
          <button class="btn-ghost" @click="reingreso = null">Cancelar</button>
          <button class="btn-primary" @click="confirmarReingreso">Reingresar</button>
        </div>
      </div>
    </div>
  </div>

  <div class="page" v-else>
    <p class="empty">Cargando expediente…</p>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import formats from '../mixin/formats'
import EmpleadoForm from '../components/EmpleadoForm.vue'
import ConceptosEmpleado from '../components/ConceptosEmpleado.vue'

const ETIQUETA_DOC = {
  contrato: 'Contrato',
  ine: 'Identificación oficial',
  curp: 'CURP',
  rfc: 'Constancia de situación fiscal',
  nss: 'Número de seguridad social',
  acta_nacimiento: 'Acta de nacimiento',
  comprobante_domicilio: 'Comprobante de domicilio',
  titulo: 'Título o certificado',
  examen_medico: 'Examen médico',
  capacitacion: 'Constancia de capacitación (DC-3)',
  renuncia: 'Renuncia o finiquito',
  otro: 'Otro'
}

const ETIQUETA_BAJA = {
  renuncia: 'Renuncia voluntaria',
  despido: 'Despido',
  fin_contrato: 'Fin de contrato',
  abandono: 'Abandono de empleo',
  jubilacion: 'Jubilación',
  defuncion: 'Defunción',
  otro: 'Otro'
}

const ETIQUETA_CONTRATO = {
  indeterminado: 'Tiempo indeterminado',
  determinado: 'Tiempo determinado',
  prueba: 'Periodo de prueba',
  capacitacion: 'Capacitación inicial',
  honorarios: 'Honorarios'
}

const ETIQUETA_INCAPACIDAD = {
  enfermedad_general: 'Enfermedad general',
  riesgo_trabajo: 'Riesgo de trabajo',
  maternidad: 'Maternidad',
  pat: 'Permiso por cuidados'
}

const ETIQUETA_PERMISO = {
  con_goce: 'Con goce de sueldo',
  sin_goce: 'Sin goce de sueldo',
  falta: 'Falta',
  retardo: 'Retardo',
  home_office: 'Home office',
  otro: 'Otro'
}

const ETIQUETA_MOVIMIENTO = {
  ingreso: 'Alta del empleado',
  cambio_salario: 'Cambio de salario',
  cambio_puesto: 'Cambio de puesto',
  cambio_departamento: 'Cambio de departamento',
  cambio_fecha_ingreso: 'Corrección de fecha de ingreso',
  baja: 'Baja',
  reingreso: 'Reingreso'
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

export default {
  name: 'EmpleadoDetalle',
  mixins: [formats],
  components: { EmpleadoForm, ConceptosEmpleado },
  props: { id: { type: [String, Number], required: true } },
  data() {
    return {
      ETIQUETA_DOC,
      ETIQUETA_BAJA,
      ETIQUETA_CONTRATO,
      ETIQUETA_INCAPACIDAD,
      ETIQUETA_PERMISO,
      ETIQUETA_MOVIMIENTO,
      empleado: null,
      documentos: [],
      vacaciones: [],
      incapacidades: [],
      permisos: [],
      movimientos: [],
      numConceptos: 0,
      tab: 'resumen',
      mostrarForm: false,
      seccionForm: 'personales',
      docForm: null,
      errorDoc: '',
      baja: null,
      reingreso: null,
      errorBaja: ''
    }
  },
  computed: {
    ...mapGetters(['usuarioActual']),
    tabs() {
      return [
        { clave: 'resumen', label: 'Resumen' },
        { clave: 'documentos', label: 'Documentos', conteo: this.documentos.length },
        { clave: 'conceptos', label: 'Percepciones y deducciones', conteo: this.numConceptos },
        { clave: 'ausencias', label: 'Ausencias', conteo: this.vacaciones.length + this.incapacidades.length + this.permisos.length },
        { clave: 'historial', label: 'Historial', conteo: this.movimientos.length }
      ]
    },
    direccionCompleta() {
      const partes = [this.empleado.direccion, this.empleado.ciudad, this.empleado.estado, this.empleado.cp]
      return partes.filter(Boolean).join(', ') || '—'
    },
    textoDescansos() {
      if (!this.empleado.dias_descanso) return '—'
      return String(this.empleado.dias_descanso).split(',').map((d) => DIAS[Number(d)]).join(', ')
    },
    alertaContrato() {
      const fin = this.empleado?.fecha_fin_contrato
      if (!fin || this.empleado.estatus !== 'activo') return null
      if (fin < this.hoyIso()) return `Contrato vencido el ${this.formatFechaCorta(fin)}`
      return `Contrato termina el ${this.formatFechaCorta(fin)}`
    },
    totalFiniquito() {
      if (!this.baja) return 0
      const b = this.baja
      return (Number(b.monto_vacaciones) || 0) + (Number(b.monto_prima_vacacional) || 0) +
        (Number(b.monto_aguinaldo) || 0) + (Number(b.monto_salarios) || 0) +
        (Number(b.otras_percepciones) || 0) - (Number(b.deducciones) || 0)
    }
  },
  watch: {
    id: 'cargar'
  },
  mounted() {
    this.cargar()
  },
  methods: {
    async cargar() {
      this.empleado = await window.api.empleados.obtener(Number(this.id))
      if (!this.empleado) {
        this.$router.replace('/empleados')
        return
      }
      const [documentos, vacaciones, incapacidades, permisos, movimientos, conceptos] = await Promise.all([
        window.api.documentos.listar(Number(this.id)),
        window.api.vacaciones.listar({ empleado_id: Number(this.id), estatus: 'todos' }),
        window.api.incapacidades.listar({ empleado_id: Number(this.id) }),
        window.api.permisos.listar({ empleado_id: Number(this.id), estatus: 'todos' }),
        window.api.empleados.movimientos(Number(this.id)),
        window.api.conceptos.listar({ empleado_id: Number(this.id) })
      ])
      this.documentos = documentos
      this.vacaciones = vacaciones
      this.incapacidades = incapacidades
      this.permisos = permisos
      this.movimientos = movimientos
      this.numConceptos = conceptos.length
    },
    async cargarConceptos() {
      this.numConceptos = (await window.api.conceptos.listar({ empleado_id: Number(this.id) })).length
    },
    editar(seccion = 'personales') {
      this.seccionForm = seccion
      this.mostrarForm = true
    },
    alGuardar() {
      this.mostrarForm = false
      this.cargar()
    },

    // --- Documentos ---
    abrirDocumento(doc = null) {
      this.errorDoc = ''
      this.docForm = doc
        ? { ...doc }
        : { tipo: 'contrato', nombre: '', fecha_emision: this.hoyIso(), fecha_vencimiento: '', notas: '' }
    },
    async guardarDocumento() {
      this.errorDoc = ''
      const data = { ...this.docForm, empleado_id: Number(this.id), usuario_id: this.usuarioActual?.id }
      const res = this.docForm.id
        ? await window.api.documentos.actualizar({ id: this.docForm.id, data })
        : await window.api.documentos.agregar(data)

      if (res.canceled) return
      if (!res.ok) {
        this.errorDoc = res.mensaje
        return
      }
      this.docForm = null
      this.documentos = await window.api.documentos.listar(Number(this.id))
      this.$store.dispatch('notificar', { mensaje: 'Documento guardado' })
    },
    async abrirArchivo(doc) {
      const res = await window.api.documentos.abrir(doc.id)
      if (!res.ok && res.mensaje) {
        this.$store.dispatch('notificar', { mensaje: res.mensaje, tipo: 'error' })
      }
    },
    async exportarDoc(doc) {
      const res = await window.api.documentos.exportar(doc.id)
      if (res.ok) this.$store.dispatch('notificar', { mensaje: 'Copia guardada' })
      else if (res.mensaje) this.$store.dispatch('notificar', { mensaje: res.mensaje, tipo: 'error' })
    },
    async eliminarDoc(doc) {
      if (!confirm(`¿Eliminar "${doc.nombre}" del expediente? El archivo se borra también.`)) return
      await window.api.documentos.eliminar(doc.id)
      this.documentos = await window.api.documentos.listar(Number(this.id))
    },
    abrirCarpeta() {
      window.api.documentos.abrirCarpeta(Number(this.id))
    },
    badgeVencimiento(fecha) {
      if (fecha < this.hoyIso()) return 'badge--rojo'
      const limite = new Date()
      limite.setDate(limite.getDate() + 45)
      return fecha <= limite.toISOString().slice(0, 10) ? 'badge--ambar' : 'badge--verde'
    },
    badgeEstatusVac(estatus) {
      return {
        aprobada: 'badge--verde',
        disfrutada: 'badge--azul',
        pendiente: 'badge--ambar',
        rechazada: 'badge--rojo',
        cancelada: 'badge--rojo'
      }[estatus] || ''
    },
    tamano(bytes) {
      if (!bytes) return '—'
      if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
      return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    },

    // --- Baja ---
    async abrirBaja() {
      this.errorBaja = ''
      this.baja = {
        fecha_baja: this.hoyIso(),
        motivo: 'renuncia',
        dias_salarios: 0,
        dias_vacaciones: 0,
        monto_vacaciones: 0,
        monto_prima_vacacional: 0,
        monto_aguinaldo: 0,
        monto_salarios: 0,
        otras_percepciones: 0,
        deducciones: 0,
        descripcion: ''
      }
      await this.calcularFiniquito()
    },
    async calcularFiniquito() {
      const res = await window.api.empleados.previewFiniquito({
        id: Number(this.id),
        fecha_baja: this.baja.fecha_baja,
        dias_salarios: this.baja.dias_salarios
      })
      if (!res.ok) return
      Object.assign(this.baja, {
        dias_vacaciones: res.calculo.dias_vacaciones,
        monto_vacaciones: res.calculo.monto_vacaciones,
        monto_prima_vacacional: res.calculo.monto_prima_vacacional,
        monto_aguinaldo: res.calculo.monto_aguinaldo,
        monto_salarios: res.calculo.monto_salarios
      })
    },
    recalcularVacaciones() {
      const sd = Number(this.empleado.salario_diario) || 0
      const prima = Number(this.$store.getters.empresa?.prima_vacacional ?? 25)
      this.baja.monto_vacaciones = Math.round(sd * Number(this.baja.dias_vacaciones || 0) * 100) / 100
      this.baja.monto_prima_vacacional = Math.round((this.baja.monto_vacaciones * prima) / 100 * 100) / 100
    },
    async confirmarBaja() {
      this.errorBaja = ''
      const res = await window.api.empleados.darDeBaja({
        ...this.baja,
        empleado_id: Number(this.id),
        usuario_id: this.usuarioActual?.id
      })
      if (!res.ok) {
        this.errorBaja = res.mensaje
        return
      }
      this.baja = null
      this.$store.dispatch('notificar', { mensaje: 'Baja registrada' })
      this.cargar()
    },
    abrirReingreso() {
      this.errorBaja = ''
      this.reingreso = { fecha_ingreso: this.hoyIso() }
    },
    async confirmarReingreso() {
      const res = await window.api.empleados.reingresar({
        id: Number(this.id),
        fecha_ingreso: this.reingreso.fecha_ingreso,
        usuario_id: this.usuarioActual?.id
      })
      if (!res.ok) {
        this.errorBaja = res.mensaje
        return
      }
      this.reingreso = null
      this.$store.dispatch('notificar', { mensaje: 'Reingreso registrado' })
      this.cargar()
    }
  }
}
</script>

<style scoped>
.cabecera {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
}

.cabecera__datos {
  flex: 1;
  min-width: 0;
}

.cabecera__badges {
  display: flex;
  gap: 6px;
  margin-top: 7px;
  flex-wrap: wrap;
}

.avatar {
  width: 58px;
  height: 58px;
  border-radius: 50%;
  background: var(--primary-soft);
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 800;
  overflow: hidden;
  flex-shrink: 0;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.conteo {
  margin-left: 6px;
  background: var(--primary-soft);
  color: var(--primary);
  border-radius: 10px;
  padding: 1px 6px;
  font-size: 10.5px;
}

.contenido {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding-right: 4px;
}

.rejilla {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
  gap: 14px;
  align-items: start;
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.lista-datos {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.lista-datos li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12.5px;
  color: var(--text-2);
  padding-bottom: 6px;
  border-bottom: 1px solid #F3F1FA;
}

.lista-datos b {
  color: var(--text-1);
  text-align: right;
}

.lista-datos li.editable {
  cursor: pointer;
  border-radius: 6px;
  margin: 0 -6px;
  padding: 0 6px 6px;
}

.lista-datos li.editable:hover {
  background: var(--primary-soft);
}

.lista-datos li.editable:hover b {
  color: var(--primary);
}

.card__cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}

.card__cabecera .card__titulo {
  margin-bottom: 0;
}

.saldo {
  text-align: center;
  padding: 10px 0 16px;
}

.saldo__valor {
  font-size: 34px;
  font-weight: 800;
  color: var(--primary);
  letter-spacing: -1px;
}

.saldo__label {
  font-size: 12px;
  color: var(--text-2);
}

.bloque {
  display: block;
  text-align: center;
  text-decoration: none;
  margin-top: 14px;
}

.notas {
  font-size: 12.5px;
  color: var(--text-2);
  line-height: 1.55;
  white-space: pre-wrap;
}

.linea {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-left: 6px;
}

.linea li {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.linea__punto {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--primary);
  margin-top: 5px;
  flex-shrink: 0;
}

.linea__cambio {
  font-size: 12.5px;
  color: var(--text-2);
  margin-top: 2px;
}

.finiquito {
  margin: 8px 0 14px;
}

.total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1.5px solid var(--border);
  font-size: 15px;
  font-weight: 800;
}
</style>
