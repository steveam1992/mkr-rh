<template>
  <transition name="aviso">
    <div v-if="notificacion" :class="['aviso', `aviso--${notificacion.tipo}`]" @click="cerrar">
      {{ notificacion.mensaje }}
    </div>
  </transition>
</template>

<script setup>
import { computed } from 'vue'
import { useStore } from 'vuex'

const store = useStore()
const notificacion = computed(() => store.getters.notificacion)
const cerrar = () => store.dispatch('cerrarNotificacion')
</script>

<style scoped>
.aviso {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 500;
  max-width: 380px;
  padding: 13px 18px;
  border-radius: 12px;
  font-size: 13.5px;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
  box-shadow: 0 10px 30px rgba(30, 20, 70, 0.3);
}

.aviso--exito { background: var(--green); }
.aviso--error { background: var(--red); }
.aviso--info  { background: var(--primary); }

.aviso-enter-active,
.aviso-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.aviso-enter-from,
.aviso-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
