import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/SessionContext'
import { getUnidadDeChofer, getUnidades, invalidateUnidades } from '../lib/cache'
import TopBar from '../components/TopBar'

export default function ChoferHome() {
  const { session } = useSession()
  const navigate = useNavigate()
  const [unidad, setUnidad] = useState(null)
  const [ultimoChecklist, setUltimoChecklist] = useState(null)
  const [fallasPendientes, setFallasPendientes] = useState(0)
  const [fallasEnRevision, setFallasEnRevision] = useState(0)
  const [fallasResueltas, setFallasResueltas] = useState([])
  const [todasFallas, setTodasFallas] = useState([])
  const [loading, setLoading] = useState(true)
  const [showSelector, setShowSelector] = useState(false)
  const [showFallas, setShowFallas] = useState(false)
  const [unidadesDisponibles, setUnidadesDisponibles] = useState([])
  const [asignando, setAsignando] = useState(false)
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    setLoading(true)
    const unidadData = await getUnidadDeChofer(session.id)
    setUnidad(unidadData)

    if (unidadData) {
      const [{ data: checklistData }, { data: fallasData }] = await Promise.all([
        supabase
          .from('checklists')
          .select('*')
          .eq('unidad_id', unidadData.id)
          .order('fecha', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('reportes_fallas')
          .select('*')
          .eq('chofer_id', session.id)
          .order('fecha', { ascending: false })
          .limit(50),
      ])

      setUltimoChecklist(checklistData)
      const fallas = fallasData || []
      setTodasFallas(fallas)
      setFallasPendientes(fallas.filter((f) => f.estado === 'pendiente').length)
      setFallasEnRevision(fallas.filter((f) => f.estado === 'en_revision').length)

      // Fallas resueltas en los últimos 7 días para mostrar el feedback positivo
      const hace7dias = new Date()
      hace7dias.setDate(hace7dias.getDate() - 7)
      setFallasResueltas(fallas.filter((f) =>
        f.estado === 'resuelto' && new Date(f.fecha) >= hace7dias
      ))
    }
    setLoading(false)
  }

  async function abrirSelector() {
    const todas = await getUnidades()
    setUnidadesDisponibles(todas)
    setShowSelector(true)
  }

  async function asignarme(unidadElegida) {
    setAsignando(true)
    const teniaOtroChofer = unidadElegida.chofer_id && unidadElegida.chofer_id !== session.id
    await supabase.from('unidades').update({ chofer_id: session.id }).eq('id', unidadElegida.id)
    invalidateUnidades()
    setAsignando(false)
    setShowSelector(false)
    setAviso(teniaOtroChofer
      ? `Te asignaste ${unidadElegida.patente}. Antes la tenía otro chofer.`
      : `Te asignaste ${unidadElegida.patente}.`)
    setTimeout(() => setAviso(''), 4000)
    cargarDatos()
  }

  const hoy = new Date().toLocaleDateString('es-AR')
  const checklistHoy = ultimoChecklist &&
    new Date(ultimoChecklist.fecha).toLocaleDateString('es-AR') === hoy

  // Determina el color e ícono del estado de cada falla
  function estadoFalla(estado) {
    if (estado === 'pendiente') return { color: '#dc2626', bg: '#fee2e2', icon: '🔴', label: 'Pendiente' }
    if (estado === 'en_revision') return { color: '#d97706', bg: '#fef3c7', icon: '🔧', label: 'En revisión' }
    return { color: '#16a34a', bg: '#dcfce7', icon: '✅', label: 'Resuelto' }
  }

  return (
    <>
      <TopBar title="🚚 Mi Unidad" />
      <div className="content">
        {loading && <div className="loading-spinner">Cargando...</div>}

        {aviso && (
          <div className="card" style={{ background: '#eef4fb', borderColor: '#cbdcef', fontSize: 13.5, color: '#00558c' }}>
            {aviso}
          </div>
        )}

        {!loading && !unidad && (
          <div className="card">
            <div className="empty-state">
              <div className="icon">🚫</div>
              <p>Todavía no elegiste una unidad.</p>
            </div>
            <button className="btn btn-primary" onClick={abrirSelector}>
              🚚 Elegir mi camión
            </button>
          </div>
        )}

        {!loading && unidad && (
          <>
            {/* Datos del camión */}
            <div className="card">
              <div className="card-title">
                <span className="estado-dot" style={{
                  background: unidad.estado === 'verde' ? '#16a34a'
                    : unidad.estado === 'amarillo' ? '#d97706' : '#dc2626'
                }} />
                Patente {unidad.patente}
              </div>
              <div style={{ fontSize: 14, color: '#475569', marginBottom: 4 }}>
                {unidad.marca} {unidad.modelo} {unidad.anio ? `(${unidad.anio})` : ''}
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 10 }}>
                Kilometraje actual: {unidad.km_actual?.toLocaleString('es-AR') || 0} km
              </div>
              <button onClick={abrirSelector} style={{ background: 'none', border: 'none', color: '#006cb5', fontSize: 13, fontWeight: 600, padding: 0 }}>
                🔄 Cambiar de camión
              </button>
            </div>

            {/* Stats */}
            <div className="stat-grid">
              <div className="stat-box">
                <div className="stat-icon">{checklistHoy ? '✅' : '📋'}</div>
                <div className="num" style={{ color: checklistHoy ? '#16a34a' : '#dc2626' }}>
                  {checklistHoy ? '✓' : '✗'}
                </div>
                <div className="lbl">Checklist de hoy</div>
              </div>
              <div
                className="stat-box"
                style={{ cursor: todasFallas.length > 0 ? 'pointer' : 'default' }}
                onClick={() => todasFallas.length > 0 && setShowFallas(true)}
              >
                <div className="stat-icon">⚠️</div>
                <div className="num" style={{ color: fallasPendientes > 0 ? '#dc2626' : '#16a34a' }}>
                  {fallasPendientes}
                </div>
                <div className="lbl">Fallas pendientes {todasFallas.length > 0 ? '›' : ''}</div>
              </div>
            </div>

            {/* Banner de fallas en revisión */}
            {fallasEnRevision > 0 && (
              <div
                className="card"
                style={{ background: '#fef3c7', borderColor: '#fde68a', cursor: 'pointer' }}
                onClick={() => setShowFallas(true)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 26 }}>🔧</span>
                  <div>
                    <div style={{ fontWeight: 700, color: '#92400e', fontSize: 14 }}>
                      {fallasEnRevision} falla{fallasEnRevision !== 1 ? 's' : ''} en revisión
                    </div>
                    <div style={{ fontSize: 12.5, color: '#b45309', marginTop: 2 }}>
                      El equipo ya está trabajando en eso. Tocá para ver el detalle.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Banner de fallas resueltas recientemente */}
            {fallasResueltas.length > 0 && (
              <div
                className="card"
                style={{ background: '#f0fdf4', borderColor: '#bbf7d0', cursor: 'pointer' }}
                onClick={() => setShowFallas(true)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 26 }}>✅</span>
                  <div>
                    <div style={{ fontWeight: 700, color: '#15803d', fontSize: 14 }}>
                      {fallasResueltas.length} falla{fallasResueltas.length !== 1 ? 's' : ''} resueltas esta semana
                    </div>
                    <div style={{ fontSize: 12.5, color: '#16a34a', marginTop: 2 }}>
                      Los problemas que reportaste ya fueron solucionados. ¡Gracias!
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Checklist de hoy */}
            {!checklistHoy ? (
              <button className="btn btn-primary" onClick={() => navigate('/checklist')}>
                ✅ Completar checklist de hoy
              </button>
            ) : (
              <div className="card" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                <span style={{ fontSize: 13.5, color: '#16a34a', fontWeight: 600 }}>
                  ✓ Ya completaste el checklist de hoy
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal detalle de mis fallas */}
      {showFallas && (
        <div className="modal-overlay" onClick={() => setShowFallas(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Mis reportes de fallas</h2>
              <button className="close-btn" onClick={() => setShowFallas(false)}>✕</button>
            </div>
            {todasFallas.length === 0 && (
              <div className="empty-state" style={{ padding: 20 }}>
                <p>No reportaste ninguna falla todavía.</p>
              </div>
            )}
            {todasFallas.map((f) => {
              const st = estadoFalla(f.estado)
              return (
                <div key={f.id} style={{
                  padding: '14px 0',
                  borderBottom: '1px solid #f1f5f9',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>
                        {f.descripcion}
                      </div>
                      <div style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 4 }}>
                        {new Date(f.fecha).toLocaleDateString('es-AR')} · {f.categoria}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 12, fontWeight: 700, padding: '4px 10px',
                      borderRadius: 100, background: st.bg, color: st.color,
                      whiteSpace: 'nowrap', flexShrink: 0,
                    }}>
                      {st.icon} {st.label}
                    </span>
                  </div>
                  {f.estado === 'resuelto' && (
                    <div style={{ fontSize: 12.5, color: '#16a34a', marginTop: 6, fontWeight: 600 }}>
                      ✓ Este problema ya fue solucionado por el equipo.
                    </div>
                  )}
                  {f.estado === 'en_revision' && (
                    <div style={{ fontSize: 12.5, color: '#d97706', marginTop: 6 }}>
                      El equipo está trabajando en este problema.
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal selector de camión */}
      {showSelector && (
        <div className="modal-overlay" onClick={() => setShowSelector(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Elegí tu camión</h2>
              <button className="close-btn" onClick={() => setShowSelector(false)}>✕</button>
            </div>
            {unidadesDisponibles.length === 0 && (
              <div className="empty-state" style={{ padding: 20 }}>
                <p>No hay unidades cargadas todavía.</p>
              </div>
            )}
            {unidadesDisponibles.map((u) => (
              <button
                key={u.id}
                onClick={() => asignarme(u)}
                disabled={asignando}
                style={{
                  width: '100%', textAlign: 'left',
                  background: u.id === unidad?.id ? '#eef4fb' : 'white',
                  border: u.id === unidad?.id ? '1.5px solid #006cb5' : '1.5px solid #e2e8f0',
                  borderRadius: 12, padding: '12px 14px', marginBottom: 8,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: '#003d66', fontSize: 14.5 }}>{u.patente}</div>
                  <div style={{ fontSize: 12.5, color: '#64748b' }}>
                    {u.marca} {u.modelo} {u.choferes?.nombre ? `· Actual: ${u.choferes.nombre}` : '· Sin chofer'}
                  </div>
                </div>
                {u.id === unidad?.id && <span style={{ color: '#006cb5', fontWeight: 700 }}>✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
