import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

// Registra el service worker y chequea actualizaciones cada hora.
// Cuando Vercel despliega una nueva versión, la app se actualiza sola
// la próxima vez que el chofer o admin la abre (o dentro de la hora si ya está abierta).
registerSW({
  onRegisteredSW(swUrl, r) {
    r && setInterval(async () => {
      if (!(!r.installing && navigator)) return
      if (('connection' in navigator) && !navigator.onLine) return
      const resp = await fetch(swUrl, {
        cache: 'no-store',
        headers: { 'cache': 'no-store', 'cache-control': 'no-cache' },
      })
      if (resp?.status === 200) await r.update()
    }, 60 * 60 * 1000) // chequea cada hora
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
