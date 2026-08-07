import { registerFabricCustomProperties } from '@/features/editor/services/fabric-custom-props'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import '@/assets/styles/main.css'

registerFabricCustomProperties()

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
