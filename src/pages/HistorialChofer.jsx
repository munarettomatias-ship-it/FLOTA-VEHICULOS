import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/SessionContext'
import { CATEGORIAS_FALLA, ESTADO_FALLA } from '../lib/constants'
import TopBar from '../components/TopBar'

export default function HistorialChofer() {
  const { session } = useSession()
  const [tab, setTab] = useState('checklists')
  const [checklists, setChecklists] = useState([])
  const [fallas, setFallas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargarHistorial()
  }, [])

  async function cargarHistorial() {
    setLoading(true)
    const [{ data: checklistsData }, { data: fallasData }] = await Promise.all([
      supabase.from('checklists').select('*').eq('chofer_id', session.id).order('fecha', { ascending: false }).limit(30),
      supabase.from('reportes_fallas').select('*, unidades(patente)').eq('chofer_id', session.id).order('fecha', { ascending: false }).limit(30),
    ])
    setChecklists(checklistsData || [])
    setFallas(fallasData || [])
    setLoading(false)
  }

  return (
    <>
      <TopBar title="📋 Mi historial" />
      <div className="content">
        <div className="tabs">
          <button className={`tab-btn ${tab === 'checklists' ? 'active' : ''}`} onClick={() => setTab('checklists')}>
            ✅ Checklists
          </button>
          <button className={`tab-btn ${tab === 'fallas' ? 'active' : ''}`} onClick={() => setTab('fallas')}>
            ⚠️ Fallas reportadas
          </button>
        </div>

        {loading && <div className="loading-spinner">Cargando...</div>}

        {!loading && tab === 'checklists' && (
          <>
            {checklists.length === 0 && (
              <div className="card">
                <div className="empty-state"><div className="icon">✅</div><p>Sin checklists todavía</p></div>
              </div>
            )}
            {checklists.map((c) => (
              <div key={c.id} className="card" style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: 13.5 }}>{new Date(c.fecha).toLocaleString('es-AR')}</strong>
                  {c.tiene_fallas ? (
                    <span className="badge" style={{ background: '#dc2626' }}>Con fallas</span>
                  ) : (
                    <span className="badge" style={{ background: '#16a34a' }}>OK</span>
                  )}
                </div>
                <div style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 4 }}>
                  {c.km?.toLocaleString('es-AR')} km
                </div>
                {c.observaciones && (
                  <div style={{ fontSize: 13, color: '#475569', marginTop: 6 }}>{c.observaciones}</div>
                )}
              </div>
            ))}
          </>
        )}

        {!loading && tab === 'fallas' && (
          <>
            {fallas.length === 0 && (
              <div className="card">
                <div className="empty-state"><div className="icon">⚠️</div><p>Sin reportes todavía</p></div>
              </div>
            )}
            {fallas.map((f) => {
              const cat = CATEGORIAS_FALLA.find((c) => c.key === f.categoria)
              const estadoInfo = ESTADO_FALLA.find((e) => e.key === f.estado)
              return (
                <div key={f.id} className={`falla-card gravedad-${f.gravedad}`}>
                  <div className="falla-header">
                    <strong>{cat?.icon} {cat?.label} · {f.unidades?.patente}</strong>
                    <span className="badge" style={{ background: estadoInfo?.color }}>{estadoInfo?.label}</span>
                  </div>
                  <div style={{ fontSize: 13.5, color: '#1e293b' }}>{f.descripcion}</div>
                  <div className="falla-meta">{new Date(f.fecha).toLocaleString('es-AR')}</div>
                </div>
              )
            })}
          </>
        )}
      </div>
    </>
  )
}
