import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/SessionContext'
import { CATEGORIAS_FALLA, CHECKLIST_ITEMS } from '../lib/constants'
import TopBar from '../components/TopBar'

const ESTADO_CONFIG = {
  pendiente: {
    icon: '🔴', label: 'Pendiente de revisión',
    color: '#dc2626', bg: '#fee2e2',
    mensaje: 'Tu reporte fue recibido. Pronto el equipo lo va a revisar.',
  },
  en_revision: {
    icon: '🔧', label: 'En revisión',
    color: '#d97706', bg: '#fef3c7',
    mensaje: 'El equipo ya está trabajando para resolver este problema.',
  },
  resuelto: {
    icon: '✅', label: 'Resuelto',
    color: '#16a34a', bg: '#dcfce7',
    mensaje: '¡El problema fue solucionado! Gracias por reportarlo.',
  },
}

export default function HistorialChofer() {
  const { session } = useSession()
  const [tab, setTab] = useState('fallas')
  const [checklists, setChecklists] = useState([])
  const [fallas, setFallas] = useState([])
  const [loading, setLoading] = useState(true)
  const [checklistDetalle, setChecklistDetalle] = useState(null)

  useEffect(() => {
    cargarHistorial()
  }, [])

  async function cargarHistorial() {
    setLoading(true)
    const [{ data: checklistsData }, { data: fallasData }] = await Promise.all([
      supabase
        .from('checklists')
        .select('*, unidades(patente)')
        .eq('chofer_id', session.id)
        .order('fecha', { ascending: false })
        .limit(50),
      supabase
        .from('reportes_fallas')
        .select('*, unidades(patente)')
        .eq('chofer_id', session.id)
        .order('fecha', { ascending: false })
        .limit(50),
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
          <button className={`tab-btn ${tab === 'fallas' ? 'active' : ''}`} onClick={() => setTab('fallas')}>
            ⚠️ Mis fallas
          </button>
          <button className={`tab-btn ${tab === 'checklists' ? 'active' : ''}`} onClick={() => setTab('checklists')}>
            ✅ Checklists
          </button>
        </div>

        {loading && <div className="loading-spinner">Cargando...</div>}

        {/* ── FALLAS ── */}
        {!loading && tab === 'fallas' && (
          <>
            {fallas.length === 0 && (
              <div className="card">
                <div className="empty-state">
                  <div className="icon">⚠️</div>
                  <p>No reportaste ninguna falla todavía.</p>
                </div>
              </div>
            )}

            {fallas.map((f) => {
              const cat = CATEGORIAS_FALLA.find((c) => c.key === f.categoria)
              const est = ESTADO_CONFIG[f.estado] || ESTADO_CONFIG.pendiente
              return (
                <div
                  key={f.id}
                  className="card"
                  style={{
                    marginBottom: 12,
                    borderLeft: `4px solid ${est.color}`,
                    padding: '16px',
                  }}
                >
                  {/* Cabecera: categoría + estado */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5, color: '#1e293b' }}>
                      {cat?.icon} {cat?.label}
                      {f.unidades?.patente && (
                        <span style={{ fontWeight: 400, fontSize: 12.5, color: '#64748b', marginLeft: 6 }}>
                          · {f.unidades.patente}
                        </span>
                      )}
                    </div>
                    <span style={{
                      fontSize: 11.5, fontWeight: 700, padding: '4px 12px',
                      borderRadius: 100, background: est.bg, color: est.color,
                      whiteSpace: 'nowrap', flexShrink: 0,
                    }}>
                      {est.icon} {est.label}
                    </span>
                  </div>

                  {/* Descripción */}
                  <div style={{ fontSize: 14, color: '#334155', marginBottom: 8 }}>{f.descripcion}</div>

                  {/* Mensaje de feedback según estado */}
                  <div style={{
                    fontSize: 13, color: est.color, fontWeight: 500,
                    background: est.bg, borderRadius: 8, padding: '8px 12px',
                    marginBottom: 8,
                  }}>
                    {est.mensaje}
                  </div>

                  {/* Meta: fecha y gravedad */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8' }}>
                    <span>{new Date(f.fecha).toLocaleDateString('es-AR')}</span>
                    <span style={{ textTransform: 'capitalize' }}>Gravedad: {f.gravedad}</span>
                  </div>
                </div>
              )
            })}
          </>
        )}

        {/* ── CHECKLISTS ── */}
        {!loading && tab === 'checklists' && (
          <>
            {checklists.length === 0 && (
              <div className="card">
                <div className="empty-state">
                  <div className="icon">✅</div>
                  <p>Sin checklists todavía.</p>
                </div>
              </div>
            )}

            {checklists.map((c) => (
              <div
                key={c.id}
                className="card"
                style={{
                  marginBottom: 10,
                  borderLeft: `4px solid ${c.tiene_fallas ? '#dc2626' : '#16a34a'}`,
                  cursor: 'pointer',
                }}
                onClick={() => setChecklistDetalle(c)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14.5, color: '#003d66' }}>
                      {c.unidades?.patente || 'Sin patente'}
                    </div>
                    <div style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 2 }}>
                      {new Date(c.fecha).toLocaleDateString('es-AR')} · {new Date(c.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      {c.km ? ` · ${c.km.toLocaleString('es-AR')} km` : ''}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 100,
                    background: c.tiene_fallas ? '#fee2e2' : '#dcfce7',
                    color: c.tiene_fallas ? '#dc2626' : '#16a34a',
                    flexShrink: 0,
                  }}>
                    {c.tiene_fallas ? '⚠️ Con fallas' : '✓ Todo OK'}
                  </span>
                </div>
                {c.observaciones && (
                  <div style={{ fontSize: 13, color: '#475569', marginTop: 6 }}>{c.observaciones}</div>
                )}
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>Tocá para ver el detalle →</div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Modal detalle de checklist */}
      {checklistDetalle && (
        <div className="modal-overlay" onClick={() => setChecklistDetalle(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Checklist — {checklistDetalle.unidades?.patente}</h2>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                  {new Date(checklistDetalle.fecha).toLocaleDateString('es-AR')}
                  {checklistDetalle.km ? ` · ${checklistDetalle.km.toLocaleString('es-AR')} km` : ''}
                </div>
              </div>
              <button className="close-btn" onClick={() => setChecklistDetalle(null)}>✕</button>
            </div>

            {CHECKLIST_ITEMS.map((item) => {
              const estado = checklistDetalle.items?.[item.key]
              if (!estado) return null
              return (
                <div
                  key={item.key}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 0', borderBottom: '1px solid #f1f5f9',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14.5 }}>
                    <span style={{ fontSize: 22 }}>{item.icon}</span>
                    {item.label}
                  </span>
                  <span style={{
                    fontSize: 12.5, fontWeight: 700, padding: '5px 14px', borderRadius: 100,
                    background: estado === 'falla' ? '#fee2e2' : '#dcfce7',
                    color: estado === 'falla' ? '#dc2626' : '#16a34a',
                    flexShrink: 0,
                  }}>
                    {estado === 'falla' ? '⚠️ Falla' : '✓ OK'}
                  </span>
                </div>
              )
            })}

            {checklistDetalle.observaciones && (
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, fontSize: 13.5, color: '#475569', marginTop: 12 }}>
                <strong>Observaciones:</strong> {checklistDetalle.observaciones}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
