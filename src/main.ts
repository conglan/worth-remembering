import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import MobileApp from './mobile/MobileApp.vue'
import { mobileRouter } from './mobile/router'
import { isMobileDevice, syncSafeAreaInsets } from './mobile/device'
import { router } from './router'
import './style.css'

const pinia = createPinia()
const mobile = isMobileDevice()

/**
 * 从桌面图标启动的 PWA 是全屏的，iOS 会在状态栏那一条叠一层系统材质，
 * 顶栏配色需要单独处理（见 style.css 的 .is-standalone）。
 * 浏览器里带 ?standalone 参数可强制进入同一效果，方便对比调试。
 */
const standaloneMode = window.matchMedia('(display-mode: standalone)').matches
  || (navigator as Navigator & { standalone?: boolean }).standalone === true
  || new URLSearchParams(window.location.search).has('standalone')
if (standaloneMode) document.documentElement.classList.add('is-standalone')
const app = createApp(mobile ? MobileApp : App)
app.use(pinia)
app.use(mobile ? mobileRouter : router)
app.mount('#app')

if (mobile) {
  document.body.classList.add('mobile-shell')
  syncSafeAreaInsets()
  window.addEventListener('orientationchange', () => window.setTimeout(syncSafeAreaInsets, 200))
}

// 注册 Service Worker（PWA 离线支持）
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  })
}
