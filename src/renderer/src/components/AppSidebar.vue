<template>
  <nav class="sidebar">
    <div class="sidebar__marca">
      <div class="sidebar__logo">
        <img v-if="empresa?.logo" :src="empresa.logo" alt="" />
        <span v-else>{{ iniciales(empresa?.nombre_empresa) || 'RH' }}</span>
      </div>
      <div class="sidebar__nombre">{{ empresa?.nombre_empresa || 'Mi Empresa' }}</div>
      <div class="sidebar__usuario" v-if="usuarioActual">
        {{ usuarioActual.nombre }} · {{ ETIQUETA_ROL[usuarioActual.rol] }}
      </div>
    </div>

    <div class="sidebar__nav">
      <template v-for="grupo in grupos" :key="grupo.titulo">
        <div class="sidebar__grupo">{{ grupo.titulo }}</div>
        <router-link
          v-for="item in grupo.items"
          :key="item.path"
          :to="item.path"
          class="nav-link"
          :class="{ 'nav-link--activo': esActivo(item.path) }"
        >
          <span class="nav-icon" v-html="ICONS[item.icono]"></span>
          <span>{{ item.label }}</span>
        </router-link>
      </template>
    </div>

    <div class="sidebar__abajo">
      <router-link to="/ajustes" class="nav-link" :class="{ 'nav-link--activo': esActivo('/ajustes') }">
        <span class="nav-icon" v-html="ICONS.ajustes"></span>
        <span>Ajustes</span>
      </router-link>
      <button class="nav-link nav-link--btn" @click="salir">
        <span class="nav-icon" v-html="ICONS.logout"></span>
        <span>Cerrar sesión</span>
      </button>
    </div>
  </nav>
</template>

<script>
import { mapGetters } from 'vuex'
import ICONS from '../utils/icons'
import formats from '../mixin/formats'

const ETIQUETA_ROL = {
  admin: 'Administrador',
  rh: 'Recursos Humanos',
  supervisor: 'Supervisor',
  consulta: 'Consulta'
}

export default {
  name: 'AppSidebar',
  mixins: [formats],
  data() {
    return {
      ICONS,
      ETIQUETA_ROL,
      grupos: [
        {
          titulo: 'Personal',
          items: [
            { path: '/', label: 'Inicio', icono: 'inicio' },
            { path: '/empleados', label: 'Empleados', icono: 'personas' },
            { path: '/organigrama', label: 'Organigrama', icono: 'organigrama' }
          ]
        },
        {
          titulo: 'Tiempo',
          items: [
            { path: '/vacaciones', label: 'Vacaciones', icono: 'palmera' },
            { path: '/incapacidades', label: 'Incapacidades', icono: 'salud' },
            { path: '/ausencias', label: 'Permisos y faltas', icono: 'ausencias' },
            { path: '/asistencia', label: 'Asistencia', icono: 'reloj' }
          ]
        },
        {
          titulo: 'Administración',
          items: [
            { path: '/nomina', label: 'Nómina', icono: 'dinero' },
            { path: '/bajas', label: 'Bajas', icono: 'salida' },
            { path: '/catalogos', label: 'Catálogos', icono: 'catalogo' },
            { path: '/reportes', label: 'Reportes', icono: 'reportes' }
          ]
        }
      ]
    }
  },
  computed: {
    ...mapGetters(['usuarioActual', 'empresa'])
  },
  methods: {
    // La raiz solo se marca en coincidencia exacta; el resto acepta subrutas
    // para que el detalle de un empleado siga resaltando "Empleados".
    esActivo(path) {
      if (path === '/') return this.$route.path === '/'
      return this.$route.path.startsWith(path)
    },
    salir() {
      this.$store.dispatch('logout')
      this.$router.replace('/login')
    }
  }
}
</script>

<style scoped>
.sidebar {
  width: 196px;
  min-width: 196px;
  background: var(--sidebar-bg);
  border-radius: var(--radius);
  display: flex;
  flex-direction: column;
  padding: 22px 0 16px;
  color: rgba(255, 255, 255, 0.65);
  -webkit-app-region: drag;
  overflow: hidden;
}

.sidebar__marca {
  padding: 0 18px 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sidebar__logo {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  color: var(--primary);
  font-weight: 800;
  font-size: 17px;
  letter-spacing: -0.5px;
}

.sidebar__logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 5px;
}

.sidebar__nombre {
  font-size: 14.5px;
  font-weight: 800;
  color: #fff;
  line-height: 1.25;
  letter-spacing: -0.2px;
}

.sidebar__usuario {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.3;
}

.sidebar__nav {
  flex: 1;
  padding: 0 10px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.sidebar__nav::-webkit-scrollbar {
  width: 0;
}

.sidebar__grupo {
  font-size: 9.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.9px;
  color: rgba(255, 255, 255, 0.34);
  padding: 12px 12px 5px;
}

.sidebar__abajo {
  padding: 12px 10px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 11px;
  text-decoration: none;
  color: rgba(255, 255, 255, 0.62);
  font-size: 13px;
  font-weight: 500;
  transition: background 0.15s, color 0.15s;
  -webkit-app-region: no-drag;
}

.nav-link:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.nav-link--activo {
  background: #fff;
  color: var(--primary);
  font-weight: 600;
}

.nav-link--activo:hover {
  background: #fff;
  color: var(--primary);
}

.nav-link--btn {
  width: 100%;
  border: none;
  background: none;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}

.nav-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}
</style>
