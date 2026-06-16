// =========================================
// Tareas en segundo plano
// Para operaciones que no necesitan bloquear la UI:
// el usuario ya "terminó" su tarea visualmente, y esto
// se termina de resolver de fondo (con reintentos si falla).
// =========================================

/**
 * Ejecuta una tarea async sin bloquear quien la llama (no se hace await).
 * Si falla, reintenta hasta `retries` veces con backoff simple.
 * Los errores finales solo se loguean: por diseño, estas tareas no deben
 * interrumpir el flujo principal del usuario.
 */
export function runInBackground(taskFn, { retries = 2, label = 'tarea' } = {}) {
  async function attempt(remaining) {
    try {
      await taskFn()
    } catch (err) {
      if (remaining > 0) {
        await new Promise((r) => setTimeout(r, 800))
        return attempt(remaining - 1)
      }
      console.error(`[background:${label}] falló tras reintentos`, err)
    }
  }
  // Disparar sin esperar (fire-and-forget)
  attempt(retries)
}

/**
 * Cola simple en memoria para encolar varias tareas de fondo y
 * asegurarse de que corran de a una (evita carreras al escribir
 * el mismo recurso, ej. el estado de una unidad).
 */
const colas = new Map()

export function runQueued(key, taskFn, opts) {
  const previa = colas.get(key) || Promise.resolve()
  const siguiente = previa
    .catch(() => {}) // no propagar errores de la tarea anterior
    .then(() => new Promise((resolve) => {
      runInBackgroundResolving(taskFn, opts, resolve)
    }))
  colas.set(key, siguiente)
  return siguiente
}

function runInBackgroundResolving(taskFn, { retries = 2, label = 'tarea' } = {}, resolve) {
  async function attempt(remaining) {
    try {
      await taskFn()
    } catch (err) {
      if (remaining > 0) {
        await new Promise((r) => setTimeout(r, 800))
        return attempt(remaining - 1)
      }
      console.error(`[background:${label}] falló tras reintentos`, err)
    } finally {
      resolve()
    }
  }
  attempt(retries)
}
