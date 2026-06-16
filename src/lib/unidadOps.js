import { supabase } from './supabase'
import { invalidateUnidades } from './cache'
import { runQueued } from './background'

/**
 * Sube una foto al bucket de Storage y devuelve su URL pública.
 * Se usa desde tareas en background para no bloquear el guardado
 * del registro principal (reporte de falla) mientras sube la imagen.
 */
export async function subirFoto(file, carpeta, idUnidad) {
  const ext = file.name.split('.').pop()
  const path = `${carpeta}/${idUnidad}-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('flota-fotos').upload(path, file)
  if (error) throw error
  const { data } = supabase.storage.from('flota-fotos').getPublicUrl(path)
  return data.publicUrl
}

/**
 * Adjunta de forma asíncrona una foto ya subida a un reporte de falla
 * existente (permite mostrar "reporte enviado" al chofer antes de que
 * termine de subir la imagen, sobre todo con señal débil en ruta).
 */
export function adjuntarFotoEnBackground(reporteId, file, idUnidad) {
  runQueued(`foto-falla-${reporteId}`, async () => {
    const url = await subirFoto(file, 'fallas', idUnidad)
    const { error } = await supabase
      .from('reportes_fallas')
      .update({ foto_url: url })
      .eq('id', reporteId)
    if (error) throw error
  }, { label: 'subir-foto-falla', retries: 3 })
}

/**
 * Recalcula el color de estado (verde/amarillo/rojo) de una unidad según
 * sus fallas pendientes, y lo persiste. Se encola por unidad para evitar
 * que dos actualizaciones simultáneas se pisen entre sí.
 */
export function actualizarEstadoUnidadEnBackground(unidadId) {
  runQueued(`estado-unidad-${unidadId}`, async () => {
    const { count: pendientes } = await supabase
      .from('reportes_fallas')
      .select('*', { count: 'exact', head: true })
      .eq('unidad_id', unidadId)
      .neq('estado', 'resuelto')

    let nuevoEstado = 'verde'
    if (pendientes > 0) {
      const { count: criticas } = await supabase
        .from('reportes_fallas')
        .select('*', { count: 'exact', head: true })
        .eq('unidad_id', unidadId)
        .eq('gravedad', 'critica')
        .neq('estado', 'resuelto')
      nuevoEstado = criticas > 0 ? 'rojo' : 'amarillo'
    }

    const { error } = await supabase
      .from('unidades')
      .update({ estado: nuevoEstado })
      .eq('id', unidadId)
    if (error) throw error

    invalidateUnidades()
  }, { label: 'estado-unidad', retries: 2 })
}
