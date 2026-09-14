<template>
  <div class="wc">
    <button class="wc__btn" title="Minimizar" @click="minimize">
      <svg width="10" height="2" viewBox="0 0 10 2"><path d="M0 1h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
    </button>
    <button class="wc__btn" title="Maximizar" @click="maximize">
      <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>
    </button>
    <button class="wc__btn wc__btn--close" title="Cerrar" @click="close">
      <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
    </button>
  </div>
</template>

<script setup>
const close = () => window.electronAPI.closeWindow()
const minimize = () => window.electronAPI.minimizeWindow()
const maximize = () => window.electronAPI.maximizeWindow()
</script>

<style scoped>
.wc {
  display: flex;
  gap: 6px;
  align-items: center;
  -webkit-app-region: no-drag;
}

.wc__btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}

.wc__btn:hover {
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
}

.wc__btn--close:hover {
  background: #e74c3c;
  color: #fff;
}
</style>
