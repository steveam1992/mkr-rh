// Debe ir primero: deja listo window.api sobre el puente del preload antes de que
// el router o la store hagan su primera llamada.
import './utils/api'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import './styles/main.css'

createApp(App).use(router).use(store).mount('#app')
