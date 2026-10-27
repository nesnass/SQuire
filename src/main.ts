import { createApp } from 'vue'
import App from './App.vue'
import { installHostBridge } from './native/lyrplay'
import { installDevStorePlugin } from './store/dev-store'
import './style.css'

// Carries settings over from the skin's earlier name; must run before any store reads storage
try {
  for (const key of ['playerId', 'homeRecent']) {
    const old = localStorage.getItem(`altskin.${key}`)
    if (old !== null && localStorage.getItem(`squire.${key}`) === null) localStorage.setItem(`squire.${key}`, old)
    localStorage.removeItem(`altskin.${key}`)
  }
} catch {
  // storage unavailable (private mode); nothing to carry over
}

const app = createApp(App)
installDevStorePlugin(app)
installHostBridge()
app.mount('#app')
