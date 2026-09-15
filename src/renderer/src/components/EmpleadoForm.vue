<template>
  <div class="modal-backdrop" @click.self="$emit('cerrar')">
    <div class="modal modal--ancho">
      <div class="modal__titulo">{{ esEdicion ? 'Editar empleado' : 'Nuevo empleado' }}</div>
      <div class="modal__sub">
        Los campos marcados son los mínimos para dar de alta; el resto se puede completar después.
      </div>

      <div class="tabs">
        <button
          v-for="s in secciones"
          :key="s.clave"
          class="tab"
          :class="{ 'tab--activa': seccion === s.clave }"
          @click="seccion = s.clave"
        >
          {{ s.label }}
        </button>
      </div>

      <div class="cuerpo">
        <!-- Datos personales -->
        <template v-if="seccion === 'personales'">
          <div class="foto-fila">
            <div class="foto">
              <img v-if="form.foto" :src="form.foto" alt="" />
              <span v-else>{{ iniciales(`${form.nombre} ${form.apellido_paterno}`) || '?' }}</span>
            </div>
            <div class="foto-acciones">
              <button type="button" class="btn-secondary btn-sm" @click="elegirFoto">
                {{ form.foto ? 'Cambiar foto' : 'Agregar foto' }}
              </button>
              <button type="button" class="btn-ghost btn-sm" v-if="form.foto" @click="form.foto = null">
                Quitar
              </button>
            </div>
          </div>

          <div class="campos">
            <div class="campo">
              <label>Nombre(s) *</label>
              <input type="text" v-model="form.nombre" />
            </div>
            <div class="campo">
              <label>Apellido paterno *</label>
              <input type="text" v-model="form.apellido_paterno" />
            </div>
            <div class="campo">
              <label>Apellido materno</label>
              <input type="text" v-model="form.apellido_materno" />
            </div>
          </div>

          <div class="campos">
            <div class="campo">
              <label>Fecha de nacimiento</label>
              <input type="date" v-model="form.fecha_nacimiento" />
            </div>
            <div class="campo">
              <label>Género</label>
              <select v-model="form.genero">
                <option :value="null">Sin especificar</option>
                <option value="femenino">Femenino</option>
                <option value="masculino">Masculino</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div class="campo">
              <label>Estado civil</label>
              <select v-model="form.estado_civil">
                <option :value="null">Sin especificar</option>
                <option value="soltero">Soltero(a)</option>
                <option value="casado">Casado(a)</option>
                <option value="union_libre">Unión libre</option>
                <option value="divorciado">Divorciado(a)</option>
                <option value="viudo">Viudo(a)</option>
              </select>
            </div>
          </div>

          <div class="campos">
            <div class="campo">
              <label>CURP</label>
              <input type="text" v-model="form.curp" maxlength="18" style="text-transform: uppercase" />
            </div>
            <div class="campo">
              <label>RFC</label>
              <input type="text" v-model="form.rfc" maxlength="13" style="text-transform: uppercase" />
            </div>
            <div class="campo">
              <label>NSS</label>
              <input type="text" v-model="form.nss" maxlength="11" />
            </div>
          </div>
        </template>

        <!-- Contacto -->
        <template v-else-if="seccion === 'contacto'">
          <div class="campos">
            <div class="campo">
              <label>Teléfono</label>
              <input type="text" v-model="form.telefono" />
            </div>
            <div class="campo">
              <label>Correo</label>
              <input type="email" v-model="form.correo" />
            </div>
          </div>
          <div class="campo">
            <label>Dirección</label>
            <input type="text" v-model="form.direccion" />
          </div>
          <div class="campos">
            <div class="campo">
              <label>Ciudad</label>
              <input type="text" v-model="form.ciudad" />
            </div>
            <div class="campo">
              <label>Estado</label>
              <input type="text" v-model="form.estado" />
            </div>
            <div class="campo">
              <label>Código postal</label>
              <input type="text" v-model="form.cp" maxlength="5" />
            </div>
          </div>
          <div class="campos">
            <div class="campo">
              <label>Contacto de emergencia</label>
              <input type="text" v-model="form.contacto_emergencia" />
            </div>
            <div class="campo">
              <label>Teléfono de emergencia</label>
              <input type="text" v-model="form.telefono_emergencia" />
            </div>
          </div>
        </template>

        <!-- Puesto -->
        <template v-else-if="seccion === 'puesto'">
          <p class="nota" v-if="!departamentos.length && !puestos.length">
            Todavía no hay departamentos ni puestos dados de alta, por eso las listas están
            vacías. Puedes guardar al empleado sin ellos y asignárselos después, o crearlos
            primero en <b>Catálogos</b>.
          </p>

          <div class="campos">
            <div class="campo">
              <label>Número de empleado</label>
              <input type="text" v-model="form.numero_empleado" :placeholder="numeroSugerido" />
            </div>
            <div class="campo">
              <label>Fecha de ingreso *</label>
              <input type="date" v-model="form.fecha_ingreso" />
            </div>
          </div>

          <div class="campos">
            <div class="campo">
              <label>Departamento</label>
              <select v-model.number="form.departamento_id" @change="form.puesto_id = null">
                <option :value="null">Sin departamento</option>
                <option v-for="d in departamentos" :key="d.id" :value="d.id">{{ d.nombre }}</option>
              </select>
            </div>
            <div class="campo">
              <label>Puesto</label>
              <select v-model.number="form.puesto_id">
                <option :value="null">Sin puesto</option>
                <option v-for="p in puestosDisponibles" :key="p.id" :value="p.id">{{ p.nombre }}</option>
              </select>
            </div>
            <div class="campo">
              <label>Jefe directo</label>
              <select v-model.number="form.jefe_id">
                <option :value="null">Sin jefe asignado</option>
                <option v-for="e in posiblesJefes" :key="e.id" :value="e.id">{{ e.nombre_completo }}</option>
              </select>
            </div>
          </div>

          <div class="campos">
            <div class="campo">
              <label>Tipo de contrato</label>
              <select v-model="form.tipo_contrato">
                <option value="indeterminado">Tiempo indeterminado</option>
                <option value="determinado">Tiempo determinado</option>
                <option value="prueba">Periodo de prueba</option>
                <option value="capacitacion">Capacitación inicial</option>
                <option value="honorarios">Honorarios</option>
              </select>
            </div>
            <div class="campo" v-if="form.tipo_contrato !== 'indeterminado'">
              <label>Termina el</label>
              <input type="date" v-model="form.fecha_fin_contrato" />
            </div>
            <div class="campo">
              <label>Tipo de jornada</label>
              <select v-model="form.tipo_jornada">
                <option value="diurna">Diurna</option>
                <option value="nocturna">Nocturna</option>
                <option value="mixta">Mixta</option>
                <option value="reducida">Reducida</option>
              </select>
            </div>
          </div>

          <div class="campos">
            <div class="campo">
              <label>Hora de entrada</label>
              <input type="time" v-model="form.hora_entrada" />
            </div>
            <div class="campo">
              <label>Hora de salida</label>
              <input type="time" v-model="form.hora_salida" />
            </div>
          </div>

          <div class="campo">
            <label>Días de descanso <span class="muted">(los que NO trabaja)</span></label>
            <div class="dias">
              <label v-for="(d, i) in DIAS" :key="i" class="checkbox">
                <input type="checkbox" :value="i" v-model="descansos" />
                {{ d }}
              </label>
            </div>
            <p class="muted">Trabaja: <b>{{ resumenLaborables }}</b> · Descansa: <b>{{ resumenDescansos }}</b></p>
            <p class="error" v-if="descansos.length >= 5">
              Marcaste {{ descansos.length }} días de descanso. Aquí van los días que el
              empleado NO trabaja: si trabaja de lunes a viernes, marca solo Sáb y Dom.
            </p>
          </div>
        </template>

        <!-- Sueldo -->
        <template v-else>
          <div class="campos">
            <div class="campo">
              <label>Salario diario *</label>
              <input type="number" min="0" step="0.01" v-model.number="form.salario_diario" @input="form.salario_mensual = 0" />
            </div>
            <div class="campo">
              <label>Salario mensual</label>
              <input type="number" min="0" step="0.01" v-model.number="form.salario_mensual" @input="form.salario_diario = 0" />
            </div>
          </div>
          <p class="muted">
            Captura uno de los dos; el otro se calcula a 30 días. El salario diario integrado
            se recalcula solo con la antigüedad, el aguinaldo y la prima vacacional de Ajustes.
          </p>

          <div class="campos" style="margin-top: 14px">
            <div class="campo">
              <label>Banco</label>
              <input type="text" v-model="form.banco" />
            </div>
            <div class="campo">
              <label>CLABE o cuenta</label>
              <input type="text" v-model="form.clabe" maxlength="18" />
            </div>
          </div>

          <div class="campo">
            <label>Notas internas</label>
            <textarea v-model="form.notas"></textarea>
          </div>
        </template>
      </div>

      <p class="error" v-if="error">{{ error }}</p>

      <div class="modal__acciones">
        <button class="btn-ghost" @click="$emit('cerrar')">Cancelar</button>
        <button class="btn-primary" :disabled="guardando" @click="guardar">
          {{ guardando ? 'Guardando...' : 'Guardar' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import formats from '../mixin/formats'

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const VACIO = {
  numero_empleado: '', nombre: '', apellido_paterno: '', apellido_materno: '',
  fecha_nacimiento: '', genero: null, estado_civil: null, curp: '', rfc: '', nss: '',
  telefono: '', correo: '', contacto_emergencia: '', telefono_emergencia: '',
  direccion: '', ciudad: '', estado: '', cp: '',
  departamento_id: null, puesto_id: null, jefe_id: null,
  fecha_ingreso: '', tipo_contrato: 'indeterminado', fecha_fin_contrato: '',
  salario_diario: 0, salario_mensual: 0,
  tipo_jornada: 'diurna', hora_entrada: '09:00', hora_salida: '18:00',
  banco: '', clabe: '', foto: null, notas: ''
}

export default {
  name: 'EmpleadoForm',
  mixins: [formats],
  props: {
    empleado: { type: Object, default: null },
    // Permite abrir el formulario directamente en la pestana que interesa.
    seccionInicial: { type: String, default: 'personales' }
  },
  emits: ['cerrar', 'guardado'],
  data() {
    return {
      DIAS,
      seccion: this.seccionInicial,
      secciones: [
        { clave: 'personales', label: 'Datos personales' },
        { clave: 'contacto', label: 'Contacto' },
        { clave: 'puesto', label: 'Puesto y jornada' },
        { clave: 'sueldo', label: 'Sueldo y banco' }
      ],
      form: { ...VACIO },
      descansos: [0],
      posiblesJefes: [],
      numeroSugerido: '',
      error: '',
      guardando: false
    }
  },
  computed: {
    ...mapGetters(['departamentos', 'puestos', 'usuarioActual']),
    esEdicion() {
      return !!this.empleado?.id
    },
    resumenDescansos() {
      return DIAS.filter((d, i) => this.descansos.includes(i)).join(', ') || 'ninguno'
    },
    resumenLaborables() {
      return DIAS.filter((d, i) => !this.descansos.includes(i)).join(', ') || 'ninguno'
    },
    puestosDisponibles() {
      if (!this.form.departamento_id) return this.puestos
      return this.puestos.filter((p) => p.departamento_id === this.form.departamento_id)
    }
  },
  async mounted() {
    if (this.empleado) {
      this.form = { ...VACIO, ...this.empleado }
      this.descansos = this.empleado.dias_descanso
        ? String(this.empleado.dias_descanso).split(',').map(Number)
        : [0]
    } else {
      this.form.fecha_ingreso = this.hoyIso()
      this.numeroSugerido = await window.api.empleados.siguienteNumero()
    }

    const lista = await window.api.empleados.listar({ estatus: 'activo' })
    this.posiblesJefes = lista.filter((e) => e.id !== this.empleado?.id)
  },
  methods: {
    async elegirFoto() {
      const res = await window.api.empleados.seleccionarFoto()
      if (res.ok) this.form.foto = res.dataUrl
      else if (res.mensaje) this.error = res.mensaje
    },
    async guardar() {
      this.error = ''
      this.guardando = true
      try {
        const data = {
          ...this.form,
          dias_descanso: this.descansos.sort().join(','),
          usuario_id: this.usuarioActual?.id
        }
        const res = this.esEdicion
          ? await window.api.empleados.actualizar({ id: this.empleado.id, data })
          : await window.api.empleados.crear(data)

        if (!res.ok) {
          this.error = res.mensaje
          return
        }
        this.$store.dispatch('notificar', {
          mensaje: this.esEdicion ? 'Empleado actualizado' : 'Empleado dado de alta'
        })
        this.$emit('guardado', res.id || this.empleado.id)
      } finally {
        this.guardando = false
      }
    }
  }
}
</script>

<style scoped>
.cuerpo {
  padding-top: 16px;
  min-height: 300px;
}

.foto-fila {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-bottom: 16px;
}

.foto {
  width: 76px;
  height: 76px;
  border-radius: 50%;
  background: var(--primary-soft);
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 800;
  overflow: hidden;
  flex-shrink: 0;
}

.foto img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.foto-acciones {
  display: flex;
  gap: 8px;
}

.dias {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}
</style>
