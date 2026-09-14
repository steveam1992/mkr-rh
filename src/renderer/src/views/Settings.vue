<template>
  <div class="page">
    <div class="page__head">
      <div>
        <div class="page__title">Ajustes</div>
        <div class="page__subtitle">Datos de la empresa, prestaciones, usuarios y respaldos</div>
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
        {{ t.label }}
      </button>
    </div>

    <div class="contenido">
      <!-- Empresa -->
      <div v-if="tab === 'empresa'" class="columna">
        <section class="card">
          <div class="card__titulo">Identidad</div>
          <div class="logo">
            <div class="logo__caja">
              <img v-if="form.logo" :src="form.logo" alt="" />
              <span v-else>Sin logo</span>
            </div>
            <div class="logo__acciones">
              <button class="btn-secondary btn-sm" @click="elegirLogo">
                {{ form.logo ? 'Cambiar logo' : 'Seleccionar logo' }}
              </button>
              <button class="btn-ghost btn-sm" v-if="form.logo" @click="form.logo = null">Quitar</button>
              <p class="muted">Aparece en la barra lateral, el login y los recibos de nómina.</p>
            </div>
          </div>

          <div class="campos">
            <div class="campo">
              <label>Nombre de la empresa</label>
              <input type="text" v-model="form.nombre_empresa" />
            </div>
            <div class="campo">
              <label>Razón social</label>
              <input type="text" v-model="form.razon_social" />
            </div>
          </div>
          <div class="campos">
            <div class="campo">
              <label>RFC</label>
              <input type="text" v-model="form.rfc" />
            </div>
            <div class="campo">
              <label>Registro patronal IMSS</label>
              <input type="text" v-model="form.registro_patronal" />
            </div>
          </div>
          <div class="campo">
            <label>Dirección</label>
            <input type="text" v-model="form.direccion" />
          </div>
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
        </section>

        <div class="guardar">
          <button class="btn-primary" @click="guardar">Guardar cambios</button>
        </div>
      </div>

      <!-- Prestaciones -->
      <div v-else-if="tab === 'prestaciones'" class="columna">
        <section class="card">
          <div class="card__titulo">Parámetros generales</div>
          <div class="campos">
            <div class="campo">
              <label>Días de aguinaldo</label>
              <input type="number" min="15" step="1" v-model.number="form.dias_aguinaldo" />
            </div>
            <div class="campo">
              <label>Prima vacacional (%)</label>
              <input type="number" min="25" step="1" v-model.number="form.prima_vacacional" />
            </div>
            <div class="campo">
              <label>Periodo de nómina</label>
              <select v-model="form.periodo_nomina">
                <option value="semanal">Semanal</option>
                <option value="catorcenal">Catorcenal</option>
                <option value="quincenal">Quincenal</option>
                <option value="mensual">Mensual</option>
              </select>
            </div>
            <div class="campo">
              <label>Tolerancia de retardo (min)</label>
              <input type="number" min="0" step="1" v-model.number="form.tolerancia_retardo" />
            </div>
          </div>
          <p class="muted">
            La LFT marca 15 días de aguinaldo y 25% de prima vacacional como mínimos;
            puedes subirlos, no bajarlos.
          </p>
        </section>

        <section class="card">
          <div class="card__titulo">Días de vacaciones por antigüedad</div>
          <p class="muted" style="margin-bottom: 12px">
            Cada renglón indica: "a partir de este año de antigüedad, le tocan estos días".
            Viene precargada la tabla del artículo 76 tras la reforma de 2023.
          </p>
          <table class="data-table">
            <thead>
              <tr><th>A partir del año</th><th class="num">Días</th><th></th></tr>
            </thead>
            <tbody>
              <tr v-for="(fila, i) in tabla" :key="i">
                <td><input type="number" min="1" step="1" v-model.number="fila.anio" /></td>
                <td class="num"><input type="number" min="0" step="1" v-model.number="fila.dias" /></td>
                <td>
                  <button class="icon-btn icon-btn--danger" @click="tabla.splice(i, 1)">✕</button>
                </td>
              </tr>
            </tbody>
          </table>
          <div class="fila-acciones">
            <button class="btn-ghost btn-sm" @click="agregarFilaTabla">+ Agregar renglón</button>
            <button class="btn-secondary btn-sm" @click="guardarTabla">Guardar tabla</button>
          </div>
        </section>

        <div class="guardar">
          <button class="btn-primary" @click="guardar">Guardar cambios</button>
        </div>
      </div>

      <!-- Impuestos -->
      <div v-else-if="tab === 'impuestos'" class="columna">
        <p class="nota">
          Estos valores los actualiza la autoridad cada año. Confírmalos con tu contador antes
          de cerrar una nómina: la app no los descarga sola.
        </p>

        <section class="card">
          <div class="card__titulo">UMA y subsidio al empleo</div>
          <div class="campos">
            <div class="campo">
              <label>UMA diaria</label>
              <input type="number" min="0" step="0.01" v-model.number="form.uma_diaria" />
            </div>
            <div class="campo">
              <label>Subsidio mensual</label>
              <input type="number" min="0" step="0.01" v-model.number="form.subsidio_mensual" />
            </div>
            <div class="campo">
              <label>Tope de ingreso para el subsidio</label>
              <input type="number" min="0" step="0.01" v-model.number="form.subsidio_tope" />
            </div>
          </div>
          <p class="muted">
            La UMA se usa para las cuotas del IMSS y para las exenciones de aguinaldo (30 UMA)
            y prima vacacional (15 UMA).
          </p>
        </section>

        <section class="card">
          <div class="card__titulo">Tarifa mensual del ISR (art. 96 LISR)</div>
          <table class="data-table">
            <thead>
              <tr>
                <th class="num">Límite inferior</th>
                <th class="num">Límite superior</th>
                <th class="num">Cuota fija</th>
                <th class="num">% s/ excedente</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(fila, i) in tarifa" :key="i">
                <td class="num"><input type="number" step="0.01" v-model.number="fila.limite_inferior" /></td>
                <td class="num">
                  <input type="number" step="0.01" v-model="fila.limite_superior" placeholder="En adelante" />
                </td>
                <td class="num"><input type="number" step="0.01" v-model.number="fila.cuota_fija" /></td>
                <td class="num"><input type="number" step="0.01" v-model.number="fila.porcentaje" /></td>
                <td><button class="icon-btn icon-btn--danger" @click="tarifa.splice(i, 1)">✕</button></td>
              </tr>
            </tbody>
          </table>
          <div class="fila-acciones">
            <button class="btn-ghost btn-sm" @click="agregarFilaTarifa">+ Agregar renglón</button>
            <button class="btn-secondary btn-sm" @click="guardarTarifa">Guardar tarifa</button>
          </div>
        </section>

        <div class="guardar">
          <button class="btn-primary" @click="guardar">Guardar cambios</button>
        </div>
      </div>

      <!-- Festivos -->
      <div v-else-if="tab === 'festivos'" class="columna">
        <section class="card">
          <div class="card__titulo">Días festivos</div>
          <p class="muted" style="margin-bottom: 12px">
            No cuentan como días de vacaciones ni generan falta en el calendario de asistencia.
          </p>

          <div class="toolbar">
            <input type="date" v-model="nuevoFestivo.fecha" />
            <input type="text" class="crece" v-model="nuevoFestivo.descripcion" placeholder="Descripción" />
            <button class="btn-secondary btn-sm" @click="agregarFestivo">Agregar</button>
          </div>

          <table class="data-table" style="margin-top: 12px">
            <thead><tr><th>Fecha</th><th>Descripción</th><th></th></tr></thead>
            <tbody>
              <tr v-for="f in festivos" :key="f.id">
                <td class="principal">{{ formatFecha(f.fecha) }}</td>
                <td>{{ f.descripcion }}</td>
                <td>
                  <div class="acciones">
                    <button class="icon-btn icon-btn--danger" @click="eliminarFestivo(f)">✕</button>
                  </div>
                </td>
              </tr>
              <tr v-if="festivos.length === 0">
                <td colspan="3" class="empty">Sin días festivos registrados</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>

      <!-- Usuarios -->
      <div v-else-if="tab === 'usuarios'" class="columna">
        <section class="card">
          <div class="bloque__head">
            <div class="card__titulo">Usuarios del sistema</div>
            <button class="btn-secondary btn-sm" v-if="esAdmin" @click="abrirUsuario()">+ Nuevo usuario</button>
          </div>

          <table class="data-table">
            <thead>
              <tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th>Estado</th><th></th></tr>
            </thead>
            <tbody>
              <tr v-for="u in usuarios" :key="u.id">
                <td class="principal">{{ u.nombre }}</td>
                <td>{{ u.usuario }}</td>
                <td><span class="badge badge--morado">{{ ETIQUETA_ROL[u.rol] }}</span></td>
                <td>
                  <span :class="['badge', u.activo ? 'badge--verde' : 'badge--rojo']">
                    {{ u.activo ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>
                <td>
                  <div class="acciones" v-if="esAdmin">
                    <button class="icon-btn" title="Editar" @click="abrirUsuario(u)">✎</button>
                    <button class="btn-ghost btn-sm" @click="restablecer(u)">Contraseña</button>
                    <button class="btn-ghost btn-sm" @click="toggleActivo(u)">
                      {{ u.activo ? 'Desactivar' : 'Activar' }}
                    </button>
                    <button class="icon-btn icon-btn--danger" title="Eliminar" @click="eliminarUsuario(u)">✕</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <p class="muted" style="margin-top: 12px">
            <b>Administrador</b> ve y cambia todo · <b>Recursos Humanos</b> opera empleados, nómina y
            expedientes · <b>Supervisor</b> captura incidencias · <b>Consulta</b> solo lee.
          </p>
        </section>

        <section class="card">
          <div class="card__titulo">Mi contraseña</div>
          <div class="campos">
            <div class="campo">
              <label>Contraseña actual</label>
              <input type="password" v-model="password.actual" />
            </div>
            <div class="campo">
              <label>Nueva</label>
              <input type="password" v-model="password.nueva" />
            </div>
            <div class="campo">
              <label>Confirmar</label>
              <input type="password" v-model="password.confirmacion" />
            </div>
          </div>
          <p class="error" v-if="errorPassword">{{ errorPassword }}</p>
          <button class="btn-secondary btn-sm" @click="cambiarPassword">Cambiar contraseña</button>
        </section>
      </div>

      <!-- Datos -->
      <div v-else class="columna">
        <section class="card">
          <div class="card__titulo">Respaldo</div>
          <p class="muted" style="margin-bottom: 14px">
            El respaldo copia la base de datos y todos los archivos de los expedientes.
            Hazlo seguido y guárdalo fuera de esta computadora.
          </p>
          <div class="fila-acciones" style="justify-content: flex-start">
            <button class="btn-primary" @click="respaldar">Crear respaldo</button>
            <button class="btn-ghost" @click="restaurar">Restaurar respaldo</button>
            <button class="btn-ghost" @click="abrirCarpeta">Abrir carpeta de datos</button>
          </div>
        </section>

        <section class="card">
          <div class="card__titulo">Acerca de</div>
          <ul class="lista-datos">
            <li><span>Sistema</span><b>MKR RH</b></li>
            <li><span>Empresa configurada</span><b>{{ empresa?.nombre_empresa }}</b></li>
            <li><span>Base de datos</span><b>SQLite local</b></li>
          </ul>
          <p class="muted" style="margin-top: 12px">
            Todos los datos viven en esta computadora. Restaurar un respaldo reemplaza
            la información actual y reinicia la aplicación.
          </p>
        </section>
      </div>
    </div>

    <!-- Usuario -->
    <div class="modal-backdrop" v-if="formUsuario" @click.self="formUsuario = null">
      <div class="modal">
        <div class="modal__titulo">{{ formUsuario.id ? 'Editar usuario' : 'Nuevo usuario' }}</div>
        <div class="campo">
          <label>Nombre</label>
          <input type="text" v-model="formUsuario.nombre" />
        </div>
        <div class="campo" v-if="!formUsuario.id">
          <label>Usuario</label>
          <input type="text" v-model="formUsuario.usuario" autocomplete="off" />
        </div>
        <div class="campo" v-if="!formUsuario.id">
          <label>Contraseña</label>
          <input type="password" v-model="formUsuario.password" autocomplete="new-password" />
        </div>
        <div class="campo">
          <label>Rol</label>
          <select v-model="formUsuario.rol">
            <option v-for="(label, clave) in ETIQUETA_ROL" :key="clave" :value="clave">{{ label }}</option>
          </select>
        </div>
        <p class="error" v-if="errorUsuario">{{ errorUsuario }}</p>
        <div class="modal__acciones">
          <button class="btn-ghost" @click="formUsuario = null">Cancelar</button>
          <button class="btn-primary" @click="guardarUsuario">Guardar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import formats from '../mixin/formats'

const ETIQUETA_ROL = {
  admin: 'Administrador',
  rh: 'Recursos Humanos',
  supervisor: 'Supervisor',
  consulta: 'Consulta'
}

export default {
  name: 'Settings',
  mixins: [formats],
  data() {
    return {
      ETIQUETA_ROL,
      tab: 'empresa',
      tabs: [
        { clave: 'empresa', label: 'Empresa' },
        { clave: 'prestaciones', label: 'Prestaciones' },
        { clave: 'impuestos', label: 'Impuestos y UMA' },
        { clave: 'festivos', label: 'Días festivos' },
        { clave: 'usuarios', label: 'Usuarios' },
        { clave: 'datos', label: 'Respaldo' }
      ],
      form: {},
      tabla: [],
      tarifa: [],
      festivos: [],
      nuevoFestivo: { fecha: '', descripcion: '' },
      usuarios: [],
      formUsuario: null,
      errorUsuario: '',
      password: { actual: '', nueva: '', confirmacion: '' },
      errorPassword: ''
    }
  },
  computed: {
    ...mapGetters(['empresa', 'usuarioActual', 'esAdmin'])
  },
  async mounted() {
    this.form = { ...(this.empresa || {}) }
    const [tabla, tarifa, festivos, usuarios] = await Promise.all([
      window.api.config.tablaVacaciones(),
      window.api.config.tarifaIsr(),
      window.api.config.festivos(),
      window.api.auth.listarUsuarios()
    ])
    this.tabla = tabla
    this.tarifa = tarifa
    this.festivos = festivos
    this.usuarios = usuarios
  },
  methods: {
    async elegirLogo() {
      const res = await window.api.config.seleccionarLogo()
      if (res.ok) this.form.logo = res.dataUrl
    },
    async guardar() {
      const res = await this.$store.dispatch('guardarEmpresa', this.form)
      if (!res.ok) {
        this.$store.dispatch('notificar', { mensaje: 'No se pudo guardar', tipo: 'error' })
        return
      }
      this.form = { ...res.config }
      this.$store.dispatch('notificar', { mensaje: 'Ajustes guardados' })
    },

    agregarFilaTabla() {
      const ultimo = this.tabla[this.tabla.length - 1]
      this.tabla.push({ anio: (ultimo?.anio || 0) + 1, dias: ultimo?.dias || 12 })
    },
    async guardarTabla() {
      const res = await window.api.config.guardarTablaVacaciones(this.tabla)
      if (!res.ok) {
        this.$store.dispatch('notificar', { mensaje: res.mensaje, tipo: 'error' })
        return
      }
      this.tabla = res.tabla
      await this.$store.dispatch('cargarTablaVacaciones')
      this.$store.dispatch('notificar', { mensaje: 'Tabla de vacaciones guardada' })
    },

    agregarFilaTarifa() {
      this.tarifa.push({ limite_inferior: 0, limite_superior: null, cuota_fija: 0, porcentaje: 0 })
    },
    async guardarTarifa() {
      const res = await window.api.config.guardarTarifaIsr(this.tarifa)
      if (!res.ok) {
        this.$store.dispatch('notificar', { mensaje: res.mensaje, tipo: 'error' })
        return
      }
      this.tarifa = res.tarifa
      this.$store.dispatch('notificar', { mensaje: 'Tarifa del ISR guardada' })
    },

    async agregarFestivo() {
      const res = await window.api.config.agregarFestivo(this.nuevoFestivo)
      if (!res.ok) {
        this.$store.dispatch('notificar', { mensaje: res.mensaje, tipo: 'error' })
        return
      }
      this.nuevoFestivo = { fecha: '', descripcion: '' }
      this.festivos = await window.api.config.festivos()
    },
    async eliminarFestivo(f) {
      await window.api.config.eliminarFestivo(f.id)
      this.festivos = await window.api.config.festivos()
    },

    abrirUsuario(u = null) {
      this.errorUsuario = ''
      this.formUsuario = u ? { ...u } : { nombre: '', usuario: '', password: '', rol: 'rh' }
    },
    async guardarUsuario() {
      this.errorUsuario = ''
      const res = this.formUsuario.id
        ? await window.api.auth.actualizarUsuario(this.formUsuario)
        : await window.api.auth.crearUsuario(this.formUsuario)
      if (!res.ok) {
        this.errorUsuario = res.mensaje
        return
      }
      this.formUsuario = null
      this.usuarios = await window.api.auth.listarUsuarios()
    },
    async toggleActivo(u) {
      const res = await window.api.auth.toggleActivo({ id: u.id, activo: !u.activo })
      if (!res.ok) {
        this.$store.dispatch('notificar', { mensaje: res.mensaje, tipo: 'error' })
        return
      }
      this.usuarios = await window.api.auth.listarUsuarios()
    },
    async eliminarUsuario(u) {
      if (!confirm(`¿Eliminar al usuario "${u.usuario}"?`)) return
      const res = await window.api.auth.eliminarUsuario(u.id)
      if (!res.ok) {
        this.$store.dispatch('notificar', { mensaje: res.mensaje, tipo: 'error' })
        return
      }
      this.usuarios = await window.api.auth.listarUsuarios()
    },
    async restablecer(u) {
      const nueva = prompt(`Nueva contraseña para "${u.usuario}":`)
      if (!nueva) return
      const res = await window.api.auth.restablecerPassword({ id: u.id, passwordNueva: nueva })
      this.$store.dispatch('notificar', {
        mensaje: res.ok ? 'Contraseña restablecida' : res.mensaje,
        tipo: res.ok ? 'exito' : 'error'
      })
    },
    async cambiarPassword() {
      this.errorPassword = ''
      if (this.password.nueva !== this.password.confirmacion) {
        this.errorPassword = 'Las contraseñas no coinciden'
        return
      }
      const res = await window.api.auth.cambiarPassword({
        usuario_id: this.usuarioActual.id,
        passwordActual: this.password.actual,
        passwordNueva: this.password.nueva
      })
      if (!res.ok) {
        this.errorPassword = res.mensaje
        return
      }
      this.password = { actual: '', nueva: '', confirmacion: '' }
      this.$store.dispatch('notificar', { mensaje: 'Contraseña actualizada' })
    },

    async respaldar() {
      const res = await window.api.config.respaldar()
      if (res.canceled) return
      this.$store.dispatch('notificar', {
        mensaje: res.ok ? `Respaldo creado en ${res.ruta}` : res.mensaje,
        tipo: res.ok ? 'exito' : 'error'
      })
    },
    async restaurar() {
      const res = await window.api.config.restaurar()
      if (!res.ok && res.mensaje) {
        this.$store.dispatch('notificar', { mensaje: res.mensaje, tipo: 'error' })
      }
    },
    abrirCarpeta() {
      window.api.config.abrirCarpetaDatos()
    }
  }
}
</script>

<style scoped>
.contenido {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding-right: 4px;
}

.columna {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 860px;
}

.logo {
  display: flex;
  gap: 18px;
  align-items: center;
  margin-bottom: 18px;
}

.logo__caja {
  width: 104px;
  height: 104px;
  border-radius: 16px;
  border: 1.5px dashed var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  color: var(--text-3);
  font-size: 12px;
  background: var(--surface-2);
}

.logo__caja img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 10px;
}

.logo__acciones {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}

.bloque__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.bloque__head .card__titulo {
  margin-bottom: 0;
}

.fila-acciones {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 12px;
}

.guardar {
  display: flex;
  justify-content: flex-end;
  padding-bottom: 8px;
}

.data-table input {
  padding: 5px 8px;
  font-size: 12.5px;
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
  font-size: 12.5px;
  color: var(--text-2);
  padding-bottom: 6px;
  border-bottom: 1px solid #F3F1FA;
}

.lista-datos b {
  color: var(--text-1);
}
</style>
