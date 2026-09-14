import { createRouter, createWebHashHistory } from 'vue-router'
import store from '../store'
import Setup from '../views/Setup.vue'
import Login from '../views/Login.vue'
import Dashboard from '../views/Dashboard.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/setup', name: 'setup', component: Setup, meta: { public: true } },
    { path: '/login', name: 'login', component: Login, meta: { public: true } },
    { path: '/', name: 'dashboard', component: Dashboard },
    { path: '/empleados', name: 'empleados', component: () => import('../views/Empleados.vue') },
    { path: '/empleados/:id', name: 'empleado', component: () => import('../views/EmpleadoDetalle.vue'), props: true },
    { path: '/vacaciones', name: 'vacaciones', component: () => import('../views/Vacaciones.vue') },
    { path: '/incapacidades', name: 'incapacidades', component: () => import('../views/Incapacidades.vue') },
    { path: '/ausencias', name: 'ausencias', component: () => import('../views/Ausencias.vue') },
    { path: '/asistencia', name: 'asistencia', component: () => import('../views/Asistencia.vue') },
    { path: '/nomina', name: 'nomina', component: () => import('../views/Nomina.vue') },
    { path: '/bajas', name: 'bajas', component: () => import('../views/Bajas.vue') },
    { path: '/organigrama', name: 'organigrama', component: () => import('../views/Organigrama.vue') },
    { path: '/catalogos', name: 'catalogos', component: () => import('../views/Catalogos.vue') },
    { path: '/reportes', name: 'reportes', component: () => import('../views/Reportes.vue') },
    { path: '/ajustes', name: 'ajustes', component: () => import('../views/Settings.vue') }
  ]
})

router.beforeEach(async (to) => {
  if (store.state.requiereSetup === null) await store.dispatch('cargarEstadoSetup')

  if (store.getters.requiereSetup) return to.name === 'setup' ? true : { path: '/setup' }
  if (to.name === 'setup') return { path: '/' }

  const autenticado = store.getters.isAuthenticated
  if (!to.meta.public && !autenticado) return { path: '/login' }
  if (to.meta.public && autenticado) return { path: '/' }
  return true
})

export default router
