const CACHE_NAME = 'worth-remembering-v1.0.6'
const APP_SHELL = ['./', './index.html', './manifest.json']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // 静态资源：缓存优先，后台更新
  if (request.destination === 'script' || request.destination === 'style' || request.destination === 'image' || request.destination === 'font' || request.destination === 'manifest') {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        }).catch(() => cached)
        return cached || network
      }),
    )
    return
  }

  // 导航请求：网络优先，离线回退到缓存
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => {
        const clone = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', clone))
        return response
      }).catch(() => caches.match('./index.html')),
    )
  }
})