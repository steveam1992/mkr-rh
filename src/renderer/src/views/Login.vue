<template>
  <div class="publica">
    <form class="tarjeta" @submit.prevent="entrar">
      <div class="marca">
        <div class="marca__logo">
          <img v-if="empresa?.logo" :src="empresa.logo" alt="" />
          <span v-else>{{ iniciales(empresa?.nombre_empresa) || 'RH' }}</span>
        </div>
        <div>
          <h1>{{ empresa?.nombre_empresa || 'Recursos Humanos' }}</h1>
          <p class="marca__sub">Accede para continuar</p>
        </div>
      </div>

      <div class="campo">
        <label>Usuario</label>
        <input type="text" v-model="usuario" autofocus required />
      </div>

      <div class="campo">
        <label>Contraseña</label>
        <input type="password" v-model="password" required />
      </div>

      <p class="error" v-if="error">{{ error }}</p>

      <button class="btn-primary entrar" type="submit" :disabled="cargando">
        {{ cargando ? 'Entrando...' : 'Entrar' }}
      </button>
    </form>
  </div>
</template>

<script>
import { mapActions, mapGetters } from 'vuex'
import formats from '../mixin/formats'

export default {
  name: 'Login',
  mixins: [formats],
  data() {
    return { usuario: '', password: '', error: '', cargando: false }
  },
  computed: {
    ...mapGetters(['empresa'])
  },
  methods: {
    ...mapActions(['login']),
    async entrar() {
      this.error = ''
      this.cargando = true
      try {
        const res = await this.login({ usuario: this.usuario, password: this.password })
        if (res.ok) this.$router.replace('/')
        else this.error = res.mensaje || 'No se pudo iniciar sesión'
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
  width: 340px;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 34px 32px;
  -webkit-app-region: no-drag;
}

.marca {
  display: flex;
  gap: 13px;
  align-items: center;
  margin-bottom: 24px;
}

.marca__logo {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: var(--primary-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  color: var(--primary);
  font-weight: 800;
  font-size: 18px;
}

.marca__logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 6px;
}

h1 {
  font-size: 17px;
  font-weight: 800;
  letter-spacing: -0.4px;
  line-height: 1.2;
}

.marca__sub {
  font-size: 12.5px;
  color: var(--text-2);
  margin-top: 2px;
}

.entrar {
  width: 100%;
  margin-top: 18px;
  padding: 11px;
  font-size: 14.5px;
}
</style>
