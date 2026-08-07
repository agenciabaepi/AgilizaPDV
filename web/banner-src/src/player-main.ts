import { registerFabricCustomProperties } from '@/features/editor/services/fabric-custom-props'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PlayerApp from '@/features/player/PlayerApp.vue'
import '@/assets/styles/main.css'

registerFabricCustomProperties()

const app = createApp(PlayerApp)
app.use(createPinia())
app.mount('#app')
