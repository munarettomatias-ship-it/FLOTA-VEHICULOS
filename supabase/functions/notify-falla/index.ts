// Supabase Edge Function: notify-falla
// Versión simplificada usando web-push via npm: (más confiable)

import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!

webpush.setVapidDetails(
  'mailto:admin@mimenflota.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
)

Deno.serve(async (req) => {
  // CORS para llamadas desde el frontend
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    })
  }

  const { chofer_id, titulo, cuerpo, url } = await req.json()

  if (!chofer_id) {
    return new Response(JSON.stringify({ error: 'chofer_id requerido' }), {
      status: 400,
      headers: { 'Access-Control-Allow-Origin': '*' }
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('chofer_id', chofer_id)

  if (!subs?.length) {
    return new Response(JSON.stringify({ enviados: 0, motivo: 'sin suscripciones' }), {
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' }
    })
  }

  const payload = JSON.stringify({ titulo, cuerpo, url: url || '/' })
  let enviados = 0

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload
      )
      enviados++
    } catch (err) {
      console.error('Error enviando push:', err)
      // Si el endpoint ya no existe (410 Gone), eliminar la suscripción
      if (err?.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }

  return new Response(JSON.stringify({ enviados }), {
    status: 200,
    headers: { 'Access-Control-Allow-Origin': '*' }
  })
})
