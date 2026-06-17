import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/SessionContext'
import { TIPO_SERVICE, ESTADO_FALLA, CATEGORIAS_FALLA } from '../lib/constants'
import { getChoferes, invalidateUnidades } from '../lib/cache'
import { actualizarEstadoUnidadEnBackground } from '../lib/unidadOps'
import TopBar from '../components/TopBar'

export default function UnidadDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { session } = useSession()

  const [unidad, setUnidad] = useState(null)
  const [choferes, setChoferes] = useState([])
  const [services, setServices] = useState([])
  const [fallas, setFallas] = useState([])
  const [tab, setTab] = useState('fallas')
  const [loading, setLoading] = useState(true)
  const [showNuevoService, setShowNuevoService] = useState(false)
  const [showEditar, setShowEditar] = useState(false)

  // form nuevo service
  const [tipoService, setTipoService] = useState('correctivo')
  const [descService, setDescService] = useState('')
  const [taller, setTaller] = useState('')
  const [costo, setCosto] = useState('')
  const [kmService, setKmService] = useState('')
  const [guardando, setGuardando] = useState(false)

  // form editar unidad
  const [editChoferId, setEditChoferId] = useState('')
  const [editKm, setEditKm] = useState('')

  useEffect(() => {
    cargarTodo()
  }, [id])

  async function cargarTodo() {
    setLoading(true)

    // unidad, choferes, services y fallas no dependen entre sí: se piden
    // todas en paralelo en vez de esperar una por una.
    const [
      { data: unidadData },
      choferesData,
      { data: servicesData },
      { data: fallasData },
    ] = await Promise.all([
      supabase.from('unidades').select('*, choferes(nombre)').eq('id', id).single(),
      getChoferes(),
      supabase.from('services').select('*').eq('unidad_id', id).order('fecha', { ascending: false }),
      supabase.from('reportes_fallas').select('*, choferes(nombre)').eq('unidad_id', id).order('fecha', { ascending: false }),
    ])

    setUnidad(unidadData)
    setEditChoferId(unidadData?.chofer_id || '')
    setEditKm(unidadData?.km_actual?.toString() || '')
    setChoferes(choferesData)
    setServices(servicesData || [])
    setFallas(fallasData || [])
    setLoading(false)
  }

  async function guardarService() {
    if (!descService.trim()) return
    setGuardando(true)
    const { error } = await supabase.from('services').insert({
      unidad_id: id,
      tipo: tipoService,
      descripcion: descService.trim(),
      taller: taller.trim() || null,
      costo: costo ? parseFloat(costo) : null,
      km_realizado: kmService ? parseInt(kmService) : unidad.km_actual,
      realizado_por: session.nombre,
    })
    setGuardando(false)
    if (!error) {
      setDescService(''); setTaller(''); setCosto(''); setKmService('')
      setShowNuevoService(false)
      cargarTodo()
    }
  }

  async function cambiarEstadoFalla(fallaId, nuevoEstado) {
    await supabase.from('reportes_fallas').update({ estado: nuevoEstado }).eq('id', fallaId)
    cargarTodo()
    // Recalcular el color de estado de la unidad no necesita bloquear esta
    // pantalla: se resuelve de fondo y la caché se invalida cuando termine.
    actualizarEstadoUnidadEnBackground(id)
  }

  async function guardarEdicion() {
    setGuardando(true)
    await supabase.from('unidades').update({
      chofer_id: editChoferId || null,
      km_actual: editKm ? parseInt(editKm) : 0,
    }).eq('id', id)
    invalidateUnidades()
    setGuardando(false)
    setShowEditar(false)
    cargarTodo()
  }

  if (loading) {
    return (
      <>
        <TopBar title="Unidad" />
        <div className="loading-spinner">Cargando...</div>
      </>
    )
  }

  if (!unidad) return null

  return (
    <>
      <TopBar title={`🚚 ${unidad.patente}`} subtitle={`${unidad.marca || ''} ${unidad.modelo || ''}`} />
      <div className="content">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 13, color: '#475569' }}>👤 {unidad.choferes?.nombre || 'Sin chofer asignado'}</div>
              <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
                📍 {unidad.km_actual?.toLocaleString('es-AR') || 0} km
              </div>
            </div>
            <span className="badge" style={{
              background: unidad.estado === 'verde' ? '#16a34a' : unidad.estado === 'amarillo' ? '#d97706' : '#dc2626'
            }}>
              {unidad.estado === 'verde' ? 'OK' : unidad.estado === 'amarillo' ? 'Atención' : 'Crítico'}
            </span>
          </div>
          <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={() => setShowEditar(true)}>
            ✏️ Editar chofer / km
          </button>
        </div>

        <div className="tabs">
          <button className={`tab-btn ${tab === 'fallas' ? 'active' : ''}`} onClick={() => setTab('fallas')}>
            ⚠️ Fallas reportadas
          </button>
          <button className={`tab-btn ${tab === 'services' ? 'active' : ''}`} onClick={() => setTab('services')}>
            🔧 Historial services
          </button>
        </div>

        {tab === 'fallas' && (
          <>
            {fallas.length === 0 && (
              <div className="card">
                <div className="empty-state" style={{ padding: 24 }}>
                  <div className="icon">✅</div>
                  <p>Sin fallas reportadas</p>
                </div>
              </div>
            )}
            {fallas.map((f) => {
              const cat = CATEGORIAS_FALLA.find((c) => c.key === f.categoria)
              const estadoInfo = ESTADO_FALLA.find((e) => e.key === f.estado)
              return (
                <div key={f.id} className={`falla-card gravedad-${f.gravedad}`}>
                  <div className="falla-header">
                    <div>
                      <strong>{cat?.icon} {cat?.label}</strong>
                    </div>
                    <span className="badge" style={{ background: estadoInfo?.color }}>
                      {estadoInfo?.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 13.5, color: '#1e293b' }}>{f.descripcion}</div>
                  {f.foto_url && <img src={f.foto_url} className="photo-preview" alt="falla" />}
                  <div className="falla-meta">
                    {f.choferes?.nombre} · {new Date(f.fecha).toLocaleString('es-AR')}
                  </div>
                  {f.estado !== 'resuelto' && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                      {f.estado === 'pendiente' && (
                        <button className="btn btn-sm btn-outline" onClick={() => cambiarEstadoFalla(f.id, 'en_revision')}>
                          Marcar en revisión
                        </button>
                      )}
                      <button className="btn btn-sm btn-success" onClick={() => cambiarEstadoFalla(f.id, 'resuelto')}>
                        Marcar resuelto
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}

        {tab === 'services' && (
          <>
            {!showNuevoService && (
              <button className="btn btn-secondary" onClick={() => setShowNuevoService(true)} style={{ marginBottom: 12 }}>
                + Registrar service / arreglo
              </button>
            )}

            {showNuevoService && (
              <div className="card">
                <div className="card-title">Nuevo registro</div>
                <div className="field">
                  <label>Tipo</label>
                  <select value={tipoService} onChange={(e) => setTipoService(e.target.value)}>
                    {TIPO_SERVICE.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Descripción *</label>
                  <textarea value={descService} onChange={(e) => setDescService(e.target.value)} placeholder="Ej: Cambio de pastillas de freno delanteras" />
                </div>
                <div className="field">
                  <label>Taller / proveedor</label>
                  <input value={taller} onChange={(e) => setTaller(e.target.value)} placeholder="Ej: Taller Don José" />
                </div>
                <div className="field">
                  <label>Costo (ARS)</label>
                  <input type="number" value={costo} onChange={(e) => setCosto(e.target.value)} placeholder="0" />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Kilometraje al momento del service</label>
                  <input type="number" value={kmService} onChange={(e) => setKmService(e.target.value)} placeholder={unidad.km_actual} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button className="btn btn-outline" onClick={() => setShowNuevoService(false)}>Cancelar</button>
                  <button className="btn btn-primary" onClick={guardarService} disabled={guardando || !descService.trim()}>
                    {guardando ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            )}

            {services.length === 0 && !showNuevoService && (
              <div className="card">
                <div className="empty-state" style={{ padding: 24 }}>
                  <div className="icon">🔧</div>
                  <p>Sin registros de service todavía</p>
                </div>
              </div>
            )}

            {services.length > 0 && (
              <div className="card">
                {services.map((s) => (
                  <div key={s.id} className="history-item">
                    <div className="history-top">
                      <span>{TIPO_SERVICE.find((t) => t.key === s.tipo)?.label}</span>
                      <span className="history-date">{new Date(s.fecha).toLocaleDateString('es-AR')}</span>
                    </div>
                    <div className="history-desc">{s.descripcion}</div>
                    {s.taller && <div className="history-desc">🏪 {s.taller}</div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                      {s.costo && <span className="history-cost">${s.costo.toLocaleString('es-AR')}</span>}
                      {s.km_realizado && <span className="history-date">{s.km_realizado.toLocaleString('es-AR')} km</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {showEditar && (
        <div className="modal-overlay" onClick={() => setShowEditar(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Editar unidad</h2>
              <button className="close-btn" onClick={() => setShowEditar(false)}>✕</button>
            </div>
            <div className="field">
              <label>Chofer asignado</label>
              <select value={editChoferId} onChange={(e) => setEditChoferId(e.target.value)}>
                <option value="">Sin asignar</option>
                {choferes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Kilometraje actual</label>
              <input type="number" value={editKm} onChange={(e) => setEditKm(e.target.value)} />
            </div>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={guardarEdicion} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
