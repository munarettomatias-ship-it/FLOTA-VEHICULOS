import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = 'BIXny_2W_T6xCMCSpnry-C10aMlo272b6Is9PTHl_QMnKyTXWhN6OG3RJRAi_2ZIMCY8-RU8SQ1mNYlKKI0GmNA'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

/**
 * Solicita permiso de notificaciones y registra la suscripción del dispositivo.
 * Llama a esto cuando el chofer entra a la app por primera vez.
 * Devuelve true si se suscribió, false si rechazó o no se pudo.
 */
export async function suscribirPush(choferId) {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push no soportado en este navegador')
      return false
    }

    const permiso = await Notification.requestPermission()
    if (permiso !== 'granted') return false

    const reg = await navigator.serviceWorker.ready
    let subscription = await reg.pushManager.getSubscription()

    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    }

    const json = subscription.toJSON()

    // Guarda o actualiza la suscripción en Supabase
    await supabase.from('push_subscriptions').upsert({
      chofer_id: choferId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    }, { onConflict: 'endpoint' })

    return true
  } catch (err) {
    console.error('Error suscribiendo push:', err)
    return false
  }
}

/**
 * Verifica si este dispositivo ya tiene permiso concedido.
 */
export function pushPermitido() {
  return 'Notification' in window && Notification.permission === 'granted'
}

/**
 * Verifica si el navegador soporta push.
 */
export function pushSoportado() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}
