<template>
  <div class="publica">
    <form class="tarjeta" @submit.prevent="siguiente">
      <h1>Configuración inicial</h1>
      <p class="tarjeta__sub">
        Es la primera vez que abres el sistema. Registra tu empresa y la cuenta del administrador.
      </p>

      <div class="pasos">
        <span class="paso" :class="{ 'paso--on': paso >= 1 }">1 · Empresa</span>
        <span class="paso__linea"></span>
        <span class="paso" :class="{ 'paso--on': paso >= 2 }">2 · Identidad</span>
        <span class="paso__linea"></span>
        <span class="paso" :class="{ 'paso--on': paso >= 3 }">3 · Administrador</span>
      </div>

      <template v-if="paso === 1">
        <div class="campo">
          <label>Nombre de la empresa</label>
          <input type="text" v-model="empresa.nombre_empresa" autofocus required />
        </div>
        <div class="campo">
          <label>Razón social (opcional)</label>
          <input type="text" v-model="empresa.razon_social" />
        </div>
        <div class="campos">
          <div class="campo">
            <label>RFC (opcional)</label>
            <input type="text" v-model="empresa.rfc" />
          </div>
          <div class="campo">
            <label>Teléfono (opcional)</label>
            <input type="text" v-model="empresa.telefono" />
          </div>
        </div>
        <div class="campo">
          <label>Dirección (opcional)</label>
          <input type="text" v-model="empresa.direccion" />
        </div>
      </template>

      <template v-else-if="paso === 2">
        <p class="tarjeta__nota">
          El logo aparece en la barra lateral y en los recibos de nómina. Lo puedes cambiar
          cuando quieras desde Ajustes.
        </p>
        <div class="logo">
          <div class="logo__caja">
            <img v-if="empresa.logo" :src="empresa.logo" alt="" />
            <span v-else>Sin logo</span>
          </div>
          <div class="logo__acciones">
            <button type="button" class="btn-secondary btn-sm" @click="elegirLogo">
              {{ empresa.logo ? 'Cambiar logo' : 'Seleccionar logo' }}
            </button>
            <button type="button" class="btn-ghost btn-sm" v-if="empresa.logo" @click="empresa.logo = null">
              Quitar
            </button>
            <p class="muted">PNG, JPG, WEBP o SVG.</p>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="campo">
          <label>Nombre del administrador</label>
          <input type="text" v-model="admin.nombre" required />
        </div>
        <div class="campo">
          <label>Usuario</label>
          <input type="text" v-model="admin.usuario" autocomplete="off" required />
        </div>
        <div class="campos">
          <div class="campo">
            <label>Contraseña</label>
            <input type="password" v-model="admin.password" required />
          </div>
          <div class="campo">
            <label>Confirmar</label>
            <input type="password" v-model="admin.confirmacion" required />
          </div>
        </div>
      </template>

      <p class="error" v-if="error">{{ error }}</p>

      <div class="acciones">
        <button class="btn-ghost" type="button" v-if="paso > 1" :disabled="cargando" @click="paso--">
          Atrás
        </button>
        <button class="btn-primary crece" type="submit" :disabled="cargando">
          {{ textoBoton }}
        </button>
      </div>
    </form>
  </div>
</template>

<script>
import { mapActions } from 'vuex'

export default {
  name: 'Setup',
  data() {
    return {
      paso: 1,
      empresa: {
        nombre_empresa: '',
        razon_social: '',
        rfc: '',
        telefono: '',
        direccion: '',
        logo: null
      },
      admin: { nombre: '', usuario: '', password: '', confirmacion: '' },
      error: '',
      cargando: false
    }
  },
  computed: {
    textoBoton() {
      if (this.paso < 3) return 'Continuar'
      return this.cargando ? 'Guardando...' : 'Finalizar'
    }
  },
  methods: {
    ...mapActions(['completarSetup']),
    async elegirLogo() {
      const res = await window.api.config.seleccionarLogo()
      if (res.ok) this.empresa.logo = res.dataUrl
    },
    siguiente() {
      this.error = ''
      if (this.paso === 1) {
        if (!this.empresa.nombre_empresa.trim()) {
          this.error = 'Escribe el nombre de la empresa'
          return
        }
        this.paso = 2
        return
      }
      if (this.paso === 2) {
        this.paso = 3
        return
      }
      this.finalizar()
    },
    async finalizar() {
      if (!this.admin.nombre.trim()) {
        this.error = 'Escribe el nombre del administrador'
        return
      }
      if (!this.admin.usuario.trim()) {
        this.error = 'Escribe el nombre de usuario'
        return
      }
      if (this.admin.password.length < 4) {
        this.error = 'La contraseña debe tener al menos 4 caracteres'
        return
      }
      if (this.admin.password !== this.admin.confirmacion) {
        this.error = 'Las contraseñas no coinciden'
        return
      }

      this.cargando = true
      try {
        const res = await this.completarSetup({ ...this.empresa, ...this.admin })
        if (res.ok) this.$router.replace('/')
        else this.error = res.mensaje || 'No se pudo completar la configuración inicial'
      } finally {
        this.cargando = false
      }
    }
  }
}
</script>

<style scoped>
.publica {
  height: 100vh;
  width: 100vw;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--app-bg);
  -webkit-app-region: drag;
}

.tarjeta {
  width: 440px;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 34px 32px;
  -webkit-app-region: no-drag;
  max-height: 88vh;
  overflow-y: auto;
}

h1 {
  font-size: 21px;
  font-weight: 800;
  letter-spacing: -0.5px;
}

.tarjeta__sub {
  font-size: 12.5px;
  color: var(--text-2);
  line-height: 1.5;
  margin: 4px 0 20px;
}

.tarjeta__nota {
  font-size: 12.5px;
  color: var(--text-2);
  line-height: 1.5;
  margin-bottom: 18px;
}

.pasos {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 18px;
}

.paso {
  font-size: 10.5px;
  font-weight: 800;
  color: var(--text-3);
  white-space: nowrap;
}

.paso--on {
  color: var(--primary);
}

.paso__linea {
  flex: 1;
  height: 2px;
  border-radius: 2px;
  background: var(--border);
}

.logo {
  display: flex;
  gap: 18px;
  align-items: center;
  margin-bottom: 8px;
}

.logo__caja {
  width: 110px;
  height: 110px;
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

.acciones {
  display: flex;
  gap: 8px;
  margin-top: 22px;
}

.crece {
  flex: 1;
}
</style>
