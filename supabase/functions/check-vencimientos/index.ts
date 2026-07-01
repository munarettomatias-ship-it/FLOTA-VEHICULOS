// Supabase Edge Function: check-vencimientos
// Ejecutar diariamente via cron job desde Supabase.
// Chequea VTV, SENASA y alertas preventivas y manda pushes a choferes y admins.

import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!

webpush.setVapidDetails('mailto:admin@mimenflota.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

async function enviarPushAChofer(supabase, choferId, titulo, cuerpo, url = '/') {
  if (!choferId) return
  const { data: subs } = await supabase.from('push_subscriptions').select('*').eq('chofer_id', choferId)
  if (!subs?.length) return
  const payload = JSON.stringify({ titulo, cuerpo, url })
  for (const sub of subs) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
    } catch (err) {
      if (err?.statusCode === 410) await supabase.from('push_subscriptions').delete().eq('id', sub.id)
    }
  }
}

async function enviarPushATodos(supabase, titulo, cuerpo, url = '/vencimientos') {
  const { data: subs } = await supabase.from('push_subscriptions').select('*')
  if (!subs?.length) return
  const payload = JSON.stringify({ titulo, cuerpo, url })
  for (const sub of subs) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
    } catch (err) {
      if (err?.statusCode === 410) await supabase.from('push_subscriptions').delete().eq('id', sub.id)
    }
  }
}

Deno.serve(async (_req) => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const en7dias = new Date(hoy)
  en7dias.setDate(en7dias.getDate() + 7)
  const en7diasStr = en7dias.toISOString().slice(0, 10)

  let notificaciones = 0

  // ── 1. Vencimientos VTV / SENASA ──
  const { data: vencimientos } = await supabase
    .from('vencimientos')
    .select('*, unidades(patente, chofer_id)')
    .eq('activo', true)
    .lte('fecha_vencimiento', en7diasStr)

  for (const v of (vencimientos || [])) {
    const dias = Math.ceil((new Date(v.fecha_vencimiento + 'T00:00:00') - hoy) / 86400000)
    const tipo = v.tipo === 'vtv' ? 'VTV' : 'SENASA'
    const patente = v.unidades?.patente || 'una unidad'
    let titulo, cuerpo

    if (dias < 0) {
      titulo = `🚨 ${tipo} vencida — ${patente}`
      cuerpo = `Venció hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? 's' : ''}. Renovar urgente.`
    } else if (dias === 0) {
      titulo = `🚨 ${tipo} vence HOY — ${patente}`
      cuerpo = `El ${tipo} de ${patente} vence hoy. Renovar urgente.`
    } else {
      titulo = `⚠️ ${tipo} por vencer — ${patente}`
      cuerpo = `Vence en ${dias} día${dias !== 1 ? 's' : ''}. Coordiná la renovación.`
    }

    await enviarPushAChofer(supabase, v.unidades?.chofer_id, titulo, cuerpo, '/vencimientos')
    await enviarPushATodos(supabase, titulo, cuerpo, '/vencimientos')
    notificaciones++
  }

  // ── 2. Alertas preventivas por kilometraje ──
  const { data: alertasKm } = await supabase
    .from('alertas_preventivas')
    .select('*, unidades(patente, km_actual, chofer_id)')
    .eq('activa', true)
    .not('km_proximo', 'is', null)

  for (const a of (alertasKm || [])) {
    const kmActual = a.unidades?.km_actual || 0
    const diferencia = a.km_proximo - kmActual
    if (diferencia > 500) continue

    const patente = a.unidades?.patente || 'una unidad'
    const titulo = diferencia <= 0
      ? `🔧 Service vencido — ${patente}`
      : `⚠️ Service próximo — ${patente}`
    const cuerpo = diferencia <= 0
      ? `${a.descripcion}: superó el km límite (${kmActual.toLocaleString()} km).`
      : `${a.descripcion}: faltan solo ${diferencia.toLocaleString()} km.`

    await enviarPushAChofer(supabase, a.unidades?.chofer_id, titulo, cuerpo, '/alertas')
    await enviarPushATodos(supabase, titulo, cuerpo, '/alertas')
    notificaciones++
  }

  // ── 3. Alertas preventivas por fecha ──
  const { data: alertasFecha } = await supabase
    .from('alertas_preventivas')
    .select('*, unidades(patente, chofer_id)')
    .eq('activa', true)
    .not('fecha_proxima', 'is', null)
    .lte('fecha_proxima', en7diasStr)

  for (const a of (alertasFecha || [])) {
    const dias = Math.ceil((new Date(a.fecha_proxima + 'T00:00:00') - hoy) / 86400000)
    const patente = a.unidades?.patente || 'una unidad'
    const titulo = dias <= 0
      ? `🔧 Service vencido — ${patente}`
      : `⚠️ Service próximo — ${patente}`
    const cuerpo = dias <= 0
      ? `${a.descripcion}: venció hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? 's' : ''}.`
      : `${a.descripcion}: vence en ${dias} día${dias !== 1 ? 's' : ''}.`

    await enviarPushAChofer(supabase, a.unidades?.chofer_id, titulo, cuerpo, '/alertas')
    await enviarPushATodos(supabase, titulo, cuerpo, '/alertas')
    notificaciones++
  }

  console.log(`check-vencimientos: ${notificaciones} notificaciones enviadas`)
  return new Response(JSON.stringify({ ok: true, notificaciones }), { status: 200 })
})
