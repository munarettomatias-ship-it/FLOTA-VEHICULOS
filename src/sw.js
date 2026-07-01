import { precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

self.skipWaiting()
clientsClaim()

// Workbox inyecta acá la lista de archivos a cachear (build time)
precacheAndRoute(self.__WB_MANIFEST)

// ── Notificaciones push estilo WhatsApp ──
// Aparecen en la pantalla de bloqueo / centro de notificaciones del celular
// aunque la app esté cerrada, con sonido y vibración.
self.addEventListener('push', (event) => {
  let data = { titulo: 'Mimen Flota', cuerpo: 'Tenés una novedad', url: '/' }
  try {
    if (event.data) data = { ...data, ...event.data.json() }
  } catch (e) {
    // si no es JSON válido, usamos los valores por defecto
  }

  const options = {
    body: data.cuerpo,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
    requireInteraction: false,
    tag: 'mimen-flota-notif',
    renotify: true,
  }

  event.waitUntil(self.registration.showNotification(data.titulo, options))
})

// Al tocar la notificación, abre (o enfoca) la app
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    })
  )
})
