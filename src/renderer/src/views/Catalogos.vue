<template>
  <div class="page">
    <div class="page__head">
      <div>
        <div class="page__title">Catálogos</div>
        <div class="page__subtitle">Departamentos y puestos con los que se organiza la plantilla</div>
      </div>
    </div>

    <div class="columnas">
      <section class="bloque">
        <div class="bloque__head">
          <div class="card__titulo">Departamentos</div>
          <button class="btn-secondary btn-sm" @click="abrirDepto()">+ Nuevo</button>
        </div>
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr><th>Nombre</th><th class="num">Empleados</th><th></th></tr>
            </thead>
            <tbody>
              <tr v-for="d in departamentos" :key="d.id">
                <td>
                  <div class="principal clickable" @click="abrirDepto(d)">{{ d.nombre }}</div>
                  <div class="muted" v-if="d.descripcion">{{ d.descripcion }}</div>
                </td>
                <td class="num">{{ d.empleados }}</td>
                <td>
                  <div class="acciones">
                    <button class="icon-btn" title="Editar" @click="abrirDepto(d)">✎</button>
                    <button class="icon-btn icon-btn--danger" title="Eliminar" @click="eliminarDepto(d)">✕</button>
                  </div>
                </td>
              </tr>
              <tr v-if="departamentos.length === 0">
                <td colspan="3" class="empty">Sin departamentos. Crea el primero.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="bloque">
        <div class="bloque__head">
          <div class="card__titulo">Puestos</div>
          <button class="btn-secondary btn-sm" @click="abrirPuesto()">+ Nuevo</button>
        </div>
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr><th>Puesto</th><th>Departamento</th><th class="num">Rango salarial</th><th class="num">Empleados</th><th></th></tr>
            </thead>
            <tbody>
              <tr v-for="p in puestos" :key="p.id">
                <td>
                  <div class="principal clickable" @click="abrirPuesto(p)">{{ p.nombre }}</div>
                  <div class="muted" v-if="p.descripcion">{{ p.descripcion }}</div>
                </td>
                <td>{{ p.departamento || '—' }}</td>
                <td class="num">
                  <span v-if="p.salario_min || p.salario_max">
                    {{ formatMoney(p.salario_min) }} – {{ formatMoney(p.salario_max) }}
                  </span>
                  <span v-else class="muted">—</span>
                </td>
                <td class="num">{{ p.empleados }}</td>
                <td>
                  <div class="acciones">
                    <button class="icon-btn" title="Editar" @click="abrirPuesto(p)">✎</button>
                    <button class="icon-btn icon-btn--danger" title="Eliminar" @click="eliminarPuesto(p)">✕</button>
                  </div>
                </td>
              </tr>
              <tr v-if="puestos.length === 0">
                <td colspan="5" class="empty">Sin puestos. Crea el primero.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <!-- Departamento -->
    <div class="modal-backdrop" v-if="formDepto" @click.self="formDepto = null">
      <div class="modal">
        <div class="modal__titulo">{{ formDepto.id ? 'Editar departamento' : 'Nuevo departamento' }}</div>
        <div class="campo">
          <label>Nombre</label>
          <input type="text" v-model="formDepto.nombre" />
        </div>
        <div class="campo">
          <label>Descripción</label>
          <input type="text" v-model="formDepto.descripcion" />
        </div>
        <p class="error" v-if="error">{{ error }}</p>
        <div class="modal__acciones">
          <button class="btn-ghost" @click="formDepto = null">Cancelar</button>
          <button class="btn-primary" @click="guardarDepto">Guardar</button>
        </div>
      </div>
    </div>

    <!-- Puesto -->
    <div class="modal-backdrop" v-if="formPuesto" @click.self="formPuesto = null">
      <div class="modal">
        <div class="modal__titulo">{{ formPuesto.id ? 'Editar puesto' : 'Nuevo puesto' }}</div>
        <div class="campo">
          <label>Nombre</label>
          <input type="text" v-model="formPuesto.nombre" />
        </div>
        <div class="campo">
          <label>Departamento</label>
          <select v-model.number="formPuesto.departamento_id">
            <option :value="null">Sin departamento</option>
            <option v-for="d in departamentos" :key="d.id" :value="d.id">{{ d.nombre }}</option>
          </select>
        </div>
        <div class="campos">
          <div class="campo">
            <label>Salario mínimo</label>
            <input type="number" min="0" step="0.01" v-model.number="formPuesto.salario_min" />
          </div>
          <div class="campo">
            <label>Salario máximo</label>
            <input type="number" min="0" step="0.01" v-model.number="formPuesto.salario_max" />
          </div>
        </div>
        <div class="campo">
          <label>Descripción</label>
          <textarea v-model="formPuesto.descripcion"></textarea>
        </div>
        <p class="error" v-if="error">{{ error }}</p>
        <div class="modal__acciones">
          <button class="btn-ghost" @click="formPuesto = null">Cancelar</button>
          <button class="btn-primary" @click="guardarPuesto">Guardar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import formats from '../mixin/formats'

export default {
  name: 'Catalogos',
  mixins: [formats],
  data() {
    return { formDepto: null, formPuesto: null, error: '' }
  },
  computed: {
    ...mapGetters(['departamentos', 'puestos'])
  },
  methods: {
    recargar() {
      return this.$store.dispatch('cargarCatalogos')
    },
    abrirDepto(d = null) {
      this.error = ''
      this.formDepto = d ? { ...d } : { nombre: '', descripcion: '' }
    },
    async guardarDepto() {
      this.error = ''
      const res = this.formDepto.id
        ? await window.api.catalogos.actualizarDepartamento({ id: this.formDepto.id, data: this.formDepto })
        : await window.api.catalogos.crearDepartamento(this.formDepto)
      if (!res.ok) {
        this.error = res.mensaje
        return
      }
      this.formDepto = null
      await this.recargar()
    },
    async eliminarDepto(d) {
      if (!confirm(`¿Eliminar el departamento "${d.nombre}"?`)) return
      const res = await window.api.catalogos.eliminarDepartamento(d.id)
      if (!res.ok) {
        this.$store.dispatch('notificar', { mensaje: res.mensaje, tipo: 'error' })
        return
      }
      await this.recargar()
    },
    abrirPuesto(p = null) {
      this.error = ''
      this.formPuesto = p
        ? { ...p }
        : { nombre: '', departamento_id: null, descripcion: '', salario_min: 0, salario_max: 0 }
    },
    async guardarPuesto() {
      this.error = ''
      const res = this.formPuesto.id
        ? await window.api.catalogos.actualizarPuesto({ id: this.formPuesto.id, data: this.formPuesto })
        : await window.api.catalogos.crearPuesto(this.formPuesto)
      if (!res.ok) {
        this.error = res.mensaje
        return
      }
      this.formPuesto = null
      await this.recargar()
    },
    async eliminarPuesto(p) {
      if (!confirm(`¿Eliminar el puesto "${p.nombre}"?`)) return
      const res = await window.api.catalogos.eliminarPuesto(p.id)
      if (!res.ok) {
        this.$store.dispatch('notificar', { mensaje: res.mensaje, tipo: 'error' })
        return
      }
      await this.recargar()
    }
  }
}
</script>

<style scoped>
.columnas {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 20px;
  min-height: 0;
}

.bloque {
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: 10px;
}

.bloque__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.bloque__head .card__titulo {
  margin-bottom: 0;
}
</style>
