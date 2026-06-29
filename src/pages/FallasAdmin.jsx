import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { CATEGORIAS_FALLA, ESTADO_FALLA } from '../lib/constants'
import { actualizarEstadoUnidadEnBackground } from '../lib/unidadOps'
import TopBar from '../components/TopBar'

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

  async function cambiarEstado(fallaId, unidadId, nuevoEstado) {
    await supabase.from('reportes_fallas').update({ estado: nuevoEstado }).eq('id', fallaId)
    cargarFallas()
    actualizarEstadoUnidadEnBackground(unidadId)
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
                    <button className="btn btn-sm btn-outline" onClick={() => cambiarEstado(f.id, f.unidad_id, 'en_revision')}>
                      Marcar en revisión
                    </button>
                  )}
                  <button className="btn btn-sm btn-success" onClick={() => cambiarEstado(f.id, f.unidad_id, 'resuelto')}>
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
