import { useState, useEffect, useMemo } from 'react'
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

  // Form nuevo service
  const [tipoService, setTipoService] = useState('correctivo')
  const [descService, setDescService] = useState('')
  const [taller, setTaller] = useState('')
  const [repuestos, setRepuestos] = useState('') // <-- NUEVO: Estado para repuestos
  const [costo, setCosto] = useState('')
  const [kmService, setKmService] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Estados para los NUEVOS FILTROS de búsqueda
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [busqueda, setBusqueda] = useState('')

  // Form editar unidad
  const [editChoferId, setEditChoferId] = useState('')
  const [editKm, setEditKm] = useState('')

  useEffect(() => {
    cargarTodo()
  }, [id])

  async function cargarTodo() {
    setLoading(true)

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
      repuestos: repuestos.trim() || null, // <-- NUEVO: Guarda repuestos en la base de datos
      costo: costo ? parseFloat(costo) : null,
      km_realizado: kmService ? parseInt(kmService) : unidad.km_actual,
      realizado_por: session.nombre,
    })
    setGuardando(false)
    if (!error) {
      setDescService(''); setTaller(''); setRepuestos(''); setCosto(''); setKmService('')
      setShowNuevoService(false)
      cargarTodo()
    }
  }

  async function cambiarEstadoFalla(fallaId, nuevoEstado) {
    await supabase.from('reportes_fallas').update({ estado: nuevoEstado }).eq('id', fallaId)
    cargarTodo()
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

  // ========================================================
  // LÓGICA DE FILTRADO Y MÉTRICAS (PROCESADO EN TIEMPO REAL)
  // ========================================================
  const servicesFiltrados = useMemo(() => {
    return services.filter((s) => {
      const coincideTipo = filtroTipo === 'todos' || s.tipo === filtroTipo
      const termino = busqueda.toLowerCase()
      const coincideTexto = 
        (s.descripcion || '').toLowerCase().includes(termino) ||
        (s.taller || '').toLowerCase().includes(termino) ||
        (s.repuestos || '').toLowerCase().includes(termino)
      return coincideTipo && coincideTexto
    })
  }, [services, filtroTipo, busqueda])

  const metrics = useMemo(() => {
    const totalArreglos = servicesFiltrados.length
    const inversionTotal = servicesFiltrados.reduce((acc, curr) => acc + (curr.costo || 0), 0)
    return { totalArreglos, inversionTotal }
  }, [servicesFiltrados])

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
        
        {/* TARJETA INFORMATIVA DE LA UNIDAD */}
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

        {/* SELECTOR DE PESTAÑAS */}
        <div className="tabs">
          <button className={`tab-btn ${tab === 'fallas' ? 'active' : ''}`} onClick={() => setTab('fallas')}>
            ⚠️ Fallas reportadas
          </button>
          <button className={`tab-btn ${tab === 'services' ? 'active' : ''}`} onClick={() => setTab('services')}>
            🔧 Historial services
          </button>
        </div>

        {/* PESTAÑA: FALLAS */}
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

        {/* PESTAÑA: SERVICES & ARREGLOS (MEJORADA) */}
        {tab === 'services' && (
          <>
            {!showNuevoService && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button className="btn btn-secondary" onClick={() => setShowNuevoService(true)} style={{ flex: 1, marginBottom: 0 }}>
                  + Registrar service / arreglo
                </button>
              </div>
            )}

            {/* NUEVA BARRA DE FILTROS E INDICADORES PREMIUM */}
            {!showNuevoService && (
              <div className="card" style={{ padding: 14, marginBottom: 14, backgroundColor: '#f8fafc' }}>
                {/* Micro KPIs rápidos */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12, textAlign: 'center' }}>
                  <div style={{ background: '#fff', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase' }}>Registros</div>
                    <div style={{ fontSize: 18, fontHeading: 'bold', color: '#0f172a', fontWeight: 'bold' }}>{metrics.totalArreglos}</div>
                  </div>
                  <div style={{ background: '#fff', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase' }}>Inversión Total</div>
                    <div style={{ fontSize: 18, fontHeading: 'bold', color: '#16a34a', fontWeight: 'bold' }}>${metrics.inversionTotal.toLocaleString('es-AR')}</div>
                  </div>
                </div>

                {/* Inputs de filtrado */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input 
                    type="text" 
                    placeholder="🔍 Buscar por taller, repuesto o falla..." 
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ fontSize: 12, color: '#64748b', fontWeight: '500' }}>Tipo:</label>
                    <select 
                      value={filtroTipo} 
                      onChange={(e) => setFiltroTipo(e.target.value)}
                      style={{ flex: 1, padding: '6px 10px', fontSize: 13, borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#fff' }}
                    >
                      <option value="todos">Todos los registros</option>
                      <option value="preventivo">Solo Preventivos (Services)</option>
                      <option value="correctivo">Solo Correctivos (Reparaciones)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* FORMULARIO DE NUEVO SERVICE */}
            {showNuevoService && (
              <div className="card">
                <div className="card-title">Nuevo registro de mantenimiento</div>
                
                <div className="field">
                  <label>Tipo de Asistencia</label>
                  <select value={tipoService} onChange={(e) => setTipoService(e.target.value)}>
                    {TIPO_SERVICE.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </div>

                <div className="field">
                  <label>Descripción del Trabajo *</label>
                  <textarea value={descService} onChange={(e) => setDescService(e.target.value)} placeholder="Ej: Cambio de aceite de motor y filtros generales" />
                </div>

                {/* NUEVO CAMPO: Repuestos Utilizados */}
                <div className="field">
                  <label>Repuestos cambiados / Materiales</label>
                  <input value={repuestos} onChange={(e) => setRepuestos(e.target.value)} placeholder="Ej: Filtro aceite Fram, Aceite Total 10w40, pastillas Cobreq" />
                </div>

                <div className="field">
                  <label>Taller / Lugar del arreglo</label>
                  <input value={taller} onChange={(e) => setTaller(e.target.value)} placeholder="Ej: Taller Central o Gomería Misiones" />
                </div>

                <div className="field">
                  <label>Costo del arreglo (ARS)</label>
                  <input type="number" value={costo} onChange={(e) => setCosto(e.target.value)} placeholder="0" />
                </div>

                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Kilometraje al momento del service</label>
                  <input type="number" value={kmService} onChange={(e) => setKmService(e.target.value)} placeholder={unidad.km_actual} />
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button className="btn btn-outline" onClick={() => setShowNuevoService(false)}>Cancelar</button>
                  <button className="btn btn-primary" onClick={guardarService} disabled={guardando || !descService.trim()}>
                    {guardando ? 'Guardando...' : 'Guardar en Historial'}
                  </button>
                </div>
              </div>
            )}

            {/* CASO: NO HAY RESULTADOS EN LA BÚSQUEDA / VACÍO */}
            {servicesFiltrados.length === 0 && (
              <div className="card">
                <div className="empty-state" style={{ padding: 24 }}>
                  <div className="icon">🔧</div>
                  <p>{services.length === 0 ? 'Sin registros de service todavía' : 'No hay coincidencias con la búsqueda'}</p>
                </div>
              </div>
            )}

            {/* LISTADO MEJORADO ESTILO PREMIUM */}
            {servicesFiltrados.length > 0 && !showNuevoService && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {servicesFiltrados.map((s) => {
                  const esCorrectivo = s.tipo === 'correctivo'
                  return (
                    <div 
                      key={s.id} 
                      className="card" 
                      style={{ 
                        margin: 0, 
                        padding: 16, 
                        borderLeft: `5px solid ${esCorrectivo ? '#f59e0b' : '#10b981'}`,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                      }}
                    >
                      <div className="history-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ 
                          fontSize: 12, 
                          fontWeight: 'bold', 
                          padding: '2px 8px', 
                          borderRadius: '12px', 
                          backgroundColor: esCorrectivo ? '#fef3c7' : '#d1fae5',
                          color: esCorrectivo ? '#b45309' : '#065f46' 
                        }}>
                          {TIPO_SERVICE.find((t) => t.key === s.tipo)?.label || s.tipo}
                        </span>
                        <span className="history-date" style={{ fontSize: 12, color: '#64748b' }}>
                          📅 {new Date(s.fecha).toLocaleDateString('es-AR')}
                        </span>
                      </div>

                      <div className="history-desc" style={{ fontSize: 14, fontWeight: '500', color: '#1e293b', marginBottom: 6 }}>
                        {s.descripcion}
                      </div>

                      {/* Render de Lugar / Taller */}
                      {s.taller && (
                        <div style={{ fontSize: 13, color: '#475569', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                          📍 <span style={{ fontWeight: '500' }}>{s.taller}</span>
                        </div>
                      )}

                      {/* NUEVO: Render de Repuestos Cambiados */}
                      {s.repuestos && (
                        <div style={{ marginTop: 6, padding: '6px 10px', backgroundColor: '#f1f5f9', borderRadius: '6px', fontSize: 12, color: '#334155' }}>
                          <strong style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase' }}>Repuestos: </strong> 
                          {s.repuestos}
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, pt: 4, borderTop: '1px dashed #e2e8f0', paddingTop: 8 }}>
                        <div>
                          {s.costo ? (
                            <span style={{ fontSize: 15, fontWeight: 'bold', color: '#16a34a' }}>
                              ${s.costo.toLocaleString('es-AR')}
                            </span>
                          ) : (
                            <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>Sin costo registrado</span>
                          )}
                        </div>
                        {s.km_realizado && (
                          <span style={{ fontSize: 12, color: '#64748b', backgroundColor: '#f8fafc', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                            🛣️ {s.km_realizado.toLocaleString('es-AR')} km
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL: EDICIÓN DE UNIDAD */}
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
