import { supabase } from './supabase'

// =========================================
// Capa de caché en memoria (con expiración)
// Evita ir a la base de datos en cada render/navegación
// para datos que cambian poco: choferes y unidades.
// =========================================

const TTL_CHOFERES = 5 * 60 * 1000   // 5 minutos
const TTL_UNIDADES = 2 * 60 * 1000   // 2 minutos (cambia más, por estado verde/amarillo/rojo)

const cache = {
  choferes: { data: null, timestamp: 0, promise: null },
  unidades: { data: null, timestamp: 0, promise: null },
}

function isFresh(entry, ttl) {
  return entry.data !== null && Date.now() - entry.timestamp < ttl
}

/**
 * Devuelve la lista de choferes activos, usando caché si está fresca.
 * Si hay una petición en curso, la reutiliza (evita pedidos duplicados
 * cuando varios componentes piden los choferes al mismo tiempo).
 */
export async function getChoferes({ force = false } = {}) {
  const entry = cache.choferes
  if (!force && isFresh(entry, TTL_CHOFERES)) {
    return entry.data
  }
  if (!force && entry.promise) {
    return entry.promise
  }

  const promise = supabase
    .from('choferes')
    .select('*')
    .eq('activo', true)
    .order('nombre')
    .then(({ data }) => {
      entry.data = data || []
      entry.timestamp = Date.now()
      entry.promise = null
      return entry.data
    })

  entry.promise = promise
  return promise
}

/**
 * Devuelve la lista de unidades activas (con nombre de chofer), usando caché.
 */
export async function getUnidades({ force = false } = {}) {
  const entry = cache.unidades
  if (!force && isFresh(entry, TTL_UNIDADES)) {
    return entry.data
  }
  if (!force && entry.promise) {
    return entry.promise
  }

  const promise = supabase
    .from('unidades')
    .select('*, choferes(nombre)')
    .eq('activo', true)
    .order('patente')
    .then(({ data }) => {
      entry.data = data || []
      entry.timestamp = Date.now()
      entry.promise = null
      return entry.data
    })

  entry.promise = promise
  return promise
}

/**
 * Busca la unidad asignada a un chofer específico dentro de la caché de
 * unidades, evitando una query aparte por cada chofer que entra a la app.
 */
export async function getUnidadDeChofer(choferId) {
  const unidades = await getUnidades()
  return unidades.find((u) => u.chofer_id === choferId) || null
}

/**
 * Invalida la caché de unidades. Llamar después de cualquier escritura
 * que modifique unidades (alta, edición, cambio de estado por falla, etc.)
 */
export function invalidateUnidades() {
  cache.unidades.data = null
  cache.unidades.timestamp = 0
}

/**
 * Invalida la caché de choferes. Llamar después de crear/editar un chofer.
 */
export function invalidateChoferes() {
  cache.choferes.data = null
  cache.choferes.timestamp = 0
}

export function invalidateAll() {
  invalidateUnidades()
  invalidateChoferes()
}
