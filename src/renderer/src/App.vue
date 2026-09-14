<template>
  <div class="layout" v-if="isAuthenticated">
    <AppSidebar />
    <main class="layout__main">
      <router-view />
    </main>
    <div class="drag-bar">
      <WindowControls />
    </div>
    <Notificacion />
  </div>

  <div v-else class="layout layout--publica">
    <router-view />
    <div class="drag-bar">
      <WindowControls />
    </div>
    <Notificacion />
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useStore } from 'vuex'
import AppSidebar from './components/AppSidebar.vue'
import WindowControls from './components/WindowControls.vue'
import Notificacion from './components/Notificacion.vue'

const store = useStore()
const isAuthenticated = computed(() => store.getters.isAuthenticated)

onMounted(() => {
  store.dispatch('cargarEmpresa')
  store.dispatch('cargarTablaVacaciones')
})
</script>

<style scoped>
.layout {
  display: flex;
  height: 100vh;
  padding: 16px;
  padding-top: 46px;
  gap: 16px;
  overflow: hidden;
  background: var(--app-bg);
}

.layout__main {
  flex: 1;
  background: var(--surface);
  border-radius: var(--radius);
  min-width: 0;
  overflow: hidden;
  box-shadow: var(--shadow);
}

.layout--publica {
  padding: 0;
  gap: 0;
}

.drag-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 40px;
  -webkit-app-region: drag;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 20px;
}
</style>
