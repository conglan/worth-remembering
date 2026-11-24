import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import MobileApp from './mobile/MobileApp.vue'
import { mobileRouter } from './mobile/router'
import { isMobileDevice } from './mobile/device'
import { router } from './router'
import './style.css'

const pinia = createPinia()
const mobile = isMobileDevice()
const app = createApp(mobile ? MobileApp : App)
app.use(pinia)
app.use(mobile ? mobileRouter : router)
app.mount('#app')

// 注册 Service Worker（PWA 离线支持）
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  })
}
