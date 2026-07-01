import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { CATEGORIAS_FALLA, ESTADO_FALLA } from '../lib/constants'
import { actualizarEstadoUnidadEnBackground } from '../lib/unidadOps'
import TopBar from '../components/TopBar'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

async function mandarNotificacion(choferId, titulo, cuerpo) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/notify-falla`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ chofer_id: choferId, titulo, cuerpo, url: '/' }),
    })
  } catch (e) {
    console.warn('Push no enviado:', e)
  }
}

export default function FallasAdmin() {
  const navigate = useNavigate()
  const [fallas, setFallas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('pendientes')

  useEffect(() => {
    cargarFallas()
  }, [])

  async function cargarFallas() {
    setLoading(true)
    const { data } = await supabase
      .from('reportes_fallas')
      .select('*, choferes(nombre), unidades(patente)')
      .order('fecha', { ascending: false })
    setFallas(data || [])
    setLoading(false)
  }

  async function cambiarEstado(falla, nuevoEstado) {
    await supabase.from('reportes_fallas').update({ estado: nuevoEstado }).eq('id', falla.id)
    actualizarEstadoUnidadEnBackground(falla.unidad_id)

    const patente = falla.unidades?.patente || 'tu vehículo'
    if (nuevoEstado === 'en_revision') {
      mandarNotificacion(
        falla.chofer_id,
        '🔧 Falla en revisión',
        `Tu reporte en ${patente} está siendo revisado por el equipo.`
      )
    } else if (nuevoEstado === 'resuelto') {
      mandarNotificacion(
        falla.chofer_id,
        '✅ Problema resuelto',
        `El problema que reportaste en ${patente} fue solucionado.`
      )
    }

    cargarFallas()
  }

  const fallasFiltradas = fallas.filter((f) => {
    if (filtro === 'pendientes') return f.estado !== 'resuelto'
    if (filtro === 'criticas') return f.gravedad === 'critica' && f.estado !== 'resuelto'
    if (filtro === 'resueltas') return f.estado === 'resuelto'
    return true
  })

  return (
    <>
      <TopBar title="⚠️ Fallas reportadas" />
      <div className="content">
        <div className="tabs">
          {[
            { key: 'pendientes', label: 'Pendientes' },
            { key: 'criticas', label: 'Críticas' },
            { key: 'resueltas', label: 'Resueltas' },
            { key: 'todas', label: 'Todas' },
          ].map((f) => (
            <button
              key={f.key}
              className={`tab-btn ${filtro === f.key ? 'active' : ''}`}
              onClick={() => setFiltro(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading && <div className="loading-spinner">Cargando...</div>}

        {!loading && fallasFiltradas.length === 0 && (
          <div className="card">
            <div className="empty-state">
              <div className="icon">✅</div>
              <p>No hay fallas en esta categoría</p>
            </div>
          </div>
        )}

        {!loading && fallasFiltradas.map((f) => {
          const cat = CATEGORIAS_FALLA.find((c) => c.key === f.categoria)
          const estadoInfo = ESTADO_FALLA.find((e) => e.key === f.estado)
          return (
            <div key={f.id} className={`falla-card gravedad-${f.gravedad}`}>
              <div className="falla-header">
                <div>
                  <strong>{cat?.icon} {cat?.label}</strong>
                  <span
                    style={{ marginLeft: 8, fontSize: 12.5, fontWeight: 700, color: '#003d66', cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => navigate(`/unidades/${f.unidad_id}`)}
                  >
                    {f.unidades?.patente}
                  </span>
                </div>
                <span className="badge" style={{ background: estadoInfo?.color }}>
                  {estadoInfo?.label}
                </span>
              </div>
              <div style={{ fontSize: 13.5, color: '#1e293b' }}>{f.descripcion}</div>
              {f.foto_url && <img src={f.foto_url} className="photo-preview" alt="falla" />}
              <div className="falla-meta">
                👤 {f.choferes?.nombre} · {new Date(f.fecha).toLocaleString('es-AR')}
              </div>
              {f.estado !== 'resuelto' && (
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  {f.estado === 'pendiente' && (
                    <button className="btn btn-sm btn-outline" onClick={() => cambiarEstado(f, 'en_revision')}>
                      Marcar en revisión
                    </button>
                  )}
                  <button className="btn btn-sm btn-success" onClick={() => cambiarEstado(f, 'resuelto')}>
                    Marcar resuelto
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
