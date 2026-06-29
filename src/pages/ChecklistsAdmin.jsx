import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { CHECKLIST_ITEMS } from '../lib/constants'
import TopBar from '../components/TopBar'

export default function ChecklistsAdmin() {
  const [checklists, setChecklists] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todos') // 'todos' | 'con_fallas' | 'ok'
  const [detalle, setDetalle] = useState(null) // checklist seleccionado para ver detalle
  const [unidades, setUnidades] = useState([])
  const [filtroUnidad, setFiltroUnidad] = useState('')

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setLoading(true)
    const [{ data: checklistsData }, { data: unidadesData }] = await Promise.all([
      supabase
        .from('checklists')
        .select('*, unidades(patente, marca, modelo), choferes(nombre)')
        .order('fecha', { ascending: false })
        .limit(200),
      supabase
        .from('unidades')
        .select('id, patente, marca, modelo')
        .eq('activo', true)
        .order('patente'),
    ])
    setChecklists(checklistsData || [])
    setUnidades(unidadesData || [])
    setLoading(false)
  }

  const checklistsFiltrados = checklists.filter((c) => {
    const matchUnidad = !filtroUnidad || c.unidad_id === filtroUnidad
    const matchEstado =
      filtro === 'todos' ? true :
      filtro === 'con_fallas' ? c.tiene_fallas :
      !c.tiene_fallas
    return matchUnidad && matchEstado
  })

  const totalConFallas = checklists.filter((c) => c.tiene_fallas).length
  const totalOk = checklists.filter((c) => !c.tiene_fallas).length

  return (
    <>
      <TopBar title="✅ Checklists" subtitle="Historial completo" />
      <div className="content">
        {/* Resumen rápido */}
        {!loading && (
          <div className="stat-grid" style={{ marginBottom: 14 }}>
            <div className="stat-box" style={{ cursor: 'pointer', borderLeft: filtro === 'con_fallas' ? '4px solid #dc2626' : undefined }} onClick={() => setFiltro(filtro === 'con_fallas' ? 'todos' : 'con_fallas')}>
              <div className="stat-icon">⚠️</div>
              <div className="num" style={{ color: '#dc2626' }}>{totalConFallas}</div>
              <div className="lbl">Con fallas</div>
            </div>
            <div className="stat-box" style={{ cursor: 'pointer', borderLeft: filtro === 'ok' ? '4px solid #16a34a' : undefined }} onClick={() => setFiltro(filtro === 'ok' ? 'todos' : 'ok')}>
              <div className="stat-icon">✅</div>
              <div className="num" style={{ color: '#16a34a' }}>{totalOk}</div>
              <div className="lbl">Sin fallas</div>
            </div>
          </div>
        )}

        {/* Filtro por unidad */}
        <div style={{ marginBottom: 14 }}>
          <select
            value={filtroUnidad}
            onChange={(e) => setFiltroUnidad(e.target.value)}
            style={{ width: '100%', padding: 12, borderRadius: 12, border: '1.5px solid #e2e8f0', fontSize: 14 }}
          >
            <option value="">Todas las unidades</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>{u.patente} — {u.marca} {u.modelo}</option>
            ))}
          </select>
        </div>

        {loading && <div className="loading-spinner">Cargando...</div>}

        {!loading && checklistsFiltrados.length === 0 && (
          <div className="card">
            <div className="empty-state" style={{ padding: 24 }}>
              <div className="icon">📋</div>
              <p>No hay checklists en esta categoría.</p>
            </div>
          </div>
        )}

        {!loading && checklistsFiltrados.length > 0 && (
          <div className="card">
            {checklistsFiltrados.map((c) => (
              <div
                key={c.id}
                className="history-item"
                style={{ cursor: 'pointer' }}
                onClick={() => setDetalle(c)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14.5, color: '#003d66' }}>
                      {c.unidades?.patente}
                    </div>
                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                      👤 {c.choferes?.nombre || 'Chofer desconocido'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>
                      {new Date(c.fecha).toLocaleDateString('es-AR')} {new Date(c.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span style={{
                      fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 100,
                      background: c.tiene_fallas ? '#fee2e2' : '#dcfce7',
                      color: c.tiene_fallas ? '#dc2626' : '#16a34a',
                    }}>
                      {c.tiene_fallas ? '⚠️ Con fallas' : '✓ Todo OK'}
                    </span>
                  </div>
                </div>
                {c.km && (
                  <div style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 4 }}>
                    📍 {c.km.toLocaleString('es-AR')} km
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de detalle de checklist */}
      {detalle && (
        <div className="modal-overlay" onClick={() => setDetalle(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Checklist — {detalle.unidades?.patente}</h2>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                  {new Date(detalle.fecha).toLocaleDateString('es-AR')} · {detalle.choferes?.nombre}
                </div>
              </div>
              <button className="close-btn" onClick={() => setDetalle(null)}>✕</button>
            </div>

            {detalle.km && (
              <div style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
                📍 Km registrado: {detalle.km.toLocaleString('es-AR')}
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              {CHECKLIST_ITEMS.map((item) => {
                const estado = detalle.items?.[item.key]
                if (!estado) return null
                return (
                  <div
                    key={item.key}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 0', borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
                      <span style={{ fontSize: 20 }}>{item.icon}</span>
                      {item.label}
                    </span>
                    <span style={{
                      fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 100,
                      background: estado === 'falla' ? '#fee2e2' : '#dcfce7',
                      color: estado === 'falla' ? '#dc2626' : '#16a34a',
                    }}>
                      {estado === 'falla' ? '⚠️ Falla' : '✓ OK'}
                    </span>
                  </div>
                )
              })}
            </div>

            {detalle.observaciones && (
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: 12, fontSize: 13.5, color: '#475569' }}>
                <strong>Observaciones:</strong> {detalle.observaciones}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
