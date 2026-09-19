import { createApp } from 'vue'
import App from './App.vue'
import router from './app/router'

import '@/ui/tokens.css'

createApp(App).use(router).mount('#app')
