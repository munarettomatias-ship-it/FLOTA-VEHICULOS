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
  const [facturas, setFacturas] = useState([])
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
  const [repuestos, setRepuestos] = useState([])
  const [nombreRepuesto, setNombreRepuesto] = useState('')
  const [cantidadRepuesto, setCantidadRepuesto] = useState('1')
  const [costoRepuesto, setCostoRepuesto] = useState('')

  // edición de service existente
  const [serviceEditando, setServiceEditando] = useState(null)

  // form nueva factura (asociada a un service puntual)
  const [facturaParaService, setFacturaParaService] = useState(null)
  const [numeroFactura, setNumeroFactura] = useState('')
  const [fechaFactura, setFechaFactura] = useState(() => new Date().toISOString().slice(0, 10))
  const [montoFactura, setMontoFactura] = useState('')
  const [tallerFactura, setTallerFactura] = useState('')
  const [notasFactura, setNotasFactura] = useState('')

  // falla vinculada (para service y factura)
  const [fallaIdService, setFallaIdService] = useState('')
  const [fallaIdFactura, setFallaIdFactura] = useState('')
  const [fallasPendientesFlota, setFallasPendientesFlota] = useState([])

  // form editar unidad
  const [editChoferId, setEditChoferId] = useState('')
  const [editKm, setEditKm] = useState('')

  useEffect(() => {
    cargarTodo()
  }, [id])

  async function cargarTodo() {
    setLoading(true)

    // unidad, choferes, services, fallas y facturas no dependen entre sí:
    // se piden todas en paralelo en vez de esperar una por una.
    const [
      { data: unidadData },
      choferesData,
      { data: servicesData },
      { data: fallasData },
      { data: facturasData },
      { data: fallasPendientesData },
    ] = await Promise.all([
      supabase.from('unidades').select('*, choferes(nombre)').eq('id', id).single(),
      getChoferes(),
      supabase.from('services').select('*, repuestos_service(*)').eq('unidad_id', id).order('fecha', { ascending: false }),
      supabase.from('reportes_fallas').select('*, choferes(nombre)').eq('unidad_id', id).order('fecha', { ascending: false }),
      supabase.from('facturas').select('*, services(descripcion, tipo)').eq('unidad_id', id).order('fecha', { ascending: false }),
      // Todas las fallas pendientes/en revisión de TODA la flota para el selector
      supabase.from('reportes_fallas')
        .select('*, unidades(patente), choferes(nombre)')
        .neq('estado', 'resuelto')
        .order('fecha', { ascending: false }),
    ])

    setUnidad(unidadData)
    setEditChoferId(unidadData?.chofer_id || '')
    setEditKm(unidadData?.km_actual?.toString() || '')
    setChoferes(choferesData)
    setServices(servicesData || [])
    setFallas(fallasData || [])
    setFacturas(facturasData || [])
    setFallasPendientesFlota(fallasPendientesData || [])
    setLoading(false)
  }

  function agregarRepuesto() {
    if (!nombreRepuesto.trim()) return
    setRepuestos([...repuestos, {
      nombre: nombreRepuesto.trim(),
      cantidad: parseFloat(cantidadRepuesto) || 1,
      costo_unitario: costoRepuesto ? parseFloat(costoRepuesto) : null,
    }])
    setNombreRepuesto(''); setCantidadRepuesto('1'); setCostoRepuesto('')
  }

  function quitarRepuesto(index) {
    setRepuestos(repuestos.filter((_, i) => i !== index))
  }

  async function guardarService() {
    if (!descService.trim()) return
    setGuardando(true)
    const { data: nuevoService, error } = await supabase.from('services').insert({
      unidad_id: id,
      tipo: tipoService,
      descripcion: descService.trim(),
      taller: taller.trim() || null,
      costo: costo ? parseFloat(costo) : null,
      km_realizado: kmService ? parseInt(kmService) : unidad.km_actual,
      realizado_por: session.nombre,
      reporte_falla_id: fallaIdService || null,
    }).select().single()

    if (!error && nuevoService && repuestos.length > 0) {
      await supabase.from('repuestos_service').insert(
        repuestos.map((r) => ({ ...r, service_id: nuevoService.id }))
      )
    }

    // Si se vinculó una falla, marcarla como resuelta y recalcular estado de unidad
    if (!error && fallaIdService) {
      await supabase.from('reportes_fallas').update({ estado: 'resuelto' }).eq('id', fallaIdService)
      actualizarEstadoUnidadEnBackground(id)
    }

    setGuardando(false)
    if (!error) {
      setDescService(''); setTaller(''); setCosto(''); setKmService('')
      setRepuestos([]); setFallaIdService('')
      setShowNuevoService(false)
      cargarTodo()
    }
  }

  function abrirEdicionService(s) {
    setServiceEditando({
      id: s.id,
      tipo: s.tipo,
      descripcion: s.descripcion,
      taller: s.taller || '',
      costo: s.costo?.toString() || '',
      km_realizado: s.km_realizado?.toString() || '',
    })
  }

  async function guardarEdicionService() {
    if (!serviceEditando.descripcion.trim()) return
    setGuardando(true)
    await supabase.from('services').update({
      tipo: serviceEditando.tipo,
      descripcion: serviceEditando.descripcion.trim(),
      taller: serviceEditando.taller.trim() || null,
      costo: serviceEditando.costo ? parseFloat(serviceEditando.costo) : null,
      km_realizado: serviceEditando.km_realizado ? parseInt(serviceEditando.km_realizado) : null,
    }).eq('id', serviceEditando.id)
    setGuardando(false)
    setServiceEditando(null)
    cargarTodo()
  }

  async function eliminarService(serviceId) {
    if (!confirm('¿Eliminar este registro de service? Esta acción no se puede deshacer.')) return
    await supabase.from('services').delete().eq('id', serviceId)
    cargarTodo()
  }

  function abrirNuevaFactura(service) {
    setFacturaParaService(service)
    setNumeroFactura('')
    setFechaFactura(new Date().toISOString().slice(0, 10))
    setMontoFactura(service.costo?.toString() || '')
    setTallerFactura(service.taller || '')
    setNotasFactura('')
  }

  async function guardarFactura() {
    if (!montoFactura || !facturaParaService) return
    setGuardando(true)
    await supabase.from('facturas').insert({
      service_id: facturaParaService.id,
      unidad_id: id,
      numero: numeroFactura.trim() || null,
      fecha: fechaFactura,
      monto: parseFloat(montoFactura),
      taller: tallerFactura.trim() || null,
      notas: notasFactura.trim() || null,
    })

    // Si se vinculó una falla, marcarla como resuelta
    if (fallaIdFactura) {
      await supabase.from('reportes_fallas').update({ estado: 'resuelto' }).eq('id', fallaIdFactura)
      actualizarEstadoUnidadEnBackground(id)
    }

    setGuardando(false)
    setFacturaParaService(null)
    setFallaIdFactura('')
    cargarTodo()
  }

  async function eliminarFactura(facturaId) {
    if (!confirm('¿Eliminar esta factura?')) return
    await supabase.from('facturas').delete().eq('id', facturaId)
    cargarTodo()
  }

  const totalFacturado = facturas.reduce((acc, f) => acc + (f.monto || 0), 0)

  const totalGastado = services.reduce((acc, s) => acc + (s.costo || 0), 0)

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
          <button className={`tab-btn ${tab === 'facturas' ? 'active' : ''}`} onClick={() => setTab('facturas')}>
            🧾 Facturas
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

                <div className="field" style={{ marginTop: 14, marginBottom: 0 }}>
                  <label>⚠️ Falla que originó este arreglo (opcional)</label>
                  <select value={fallaIdService} onChange={(e) => setFallaIdService(e.target.value)}>
                    <option value="">— No vincular a ninguna falla —</option>
                    {fallasPendientesFlota.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.unidades?.patente} · {f.choferes?.nombre} · {f.categoria.toUpperCase()} · {f.descripcion.slice(0, 50)}{f.descripcion.length > 50 ? '...' : ''}
                      </option>
                    ))}
                  </select>
                  {fallasPendientesFlota.length === 0 && (
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                      No hay fallas pendientes en la flota.
                    </div>
                  )}
                  {fallaIdService && (
                    <div style={{ fontSize: 12, color: '#16a34a', marginTop: 4 }}>
                      ✓ Al guardar, esa falla quedará marcada como resuelta automáticamente.
                    </div>
                  )}
                </div>

                <div className="section-label" style={{ marginTop: 18 }}>Repuestos cambiados</div>
                {repuestos.map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: 13.5 }}>{r.cantidad}× {r.nombre}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {r.costo_unitario && <span style={{ fontSize: 13, color: '#475569' }}>${(r.cantidad * r.costo_unitario).toLocaleString('es-AR')}</span>}
                      <button onClick={() => quitarRepuesto(i)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 16, padding: 0 }}>✕</button>
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 6, marginTop: 10, alignItems: 'flex-end' }}>
                  <div style={{ flex: 2 }}>
                    <input placeholder="Nombre del repuesto" value={nombreRepuesto} onChange={(e) => setNombreRepuesto(e.target.value)}
                      style={{ width: '100%', padding: 10, borderRadius: 8, border: '1.5px solid #e2e8f0' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <input type="number" placeholder="Cant." value={cantidadRepuesto} onChange={(e) => setCantidadRepuesto(e.target.value)}
                      style={{ width: '100%', padding: 10, borderRadius: 8, border: '1.5px solid #e2e8f0' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <input type="number" placeholder="$ unit." value={costoRepuesto} onChange={(e) => setCostoRepuesto(e.target.value)}
                      style={{ width: '100%', padding: 10, borderRadius: 8, border: '1.5px solid #e2e8f0' }} />
                  </div>
                  <button className="btn btn-outline btn-sm" onClick={agregarRepuesto}>+</button>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button className="btn btn-outline" onClick={() => { setShowNuevoService(false); setRepuestos([]) }}>Cancelar</button>
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
              <>
                <div className="card" style={{ background: '#eef4fb', borderColor: '#cbdcef' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: '#00558c', fontWeight: 600 }}>Total invertido en mantenimiento</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: '#003d66' }}>${totalGastado.toLocaleString('es-AR')}</span>
                  </div>
                </div>

                <div className="card">
                  {services.map((s) => (
                    <div key={s.id} className="history-item">
                      <div className="history-top">
                        <span>{TIPO_SERVICE.find((t) => t.key === s.tipo)?.label}</span>
                        <span className="history-date">{new Date(s.fecha).toLocaleDateString('es-AR')}</span>
                      </div>
                      <div className="history-desc">{s.descripcion}</div>
                      {s.taller && <div className="history-desc">🏪 {s.taller}</div>}

                      {s.repuestos_service?.length > 0 && (
                        <div style={{ marginTop: 6, paddingLeft: 10, borderLeft: '2px solid #e2e8f0' }}>
                          {s.repuestos_service.map((r) => (
                            <div key={r.id} style={{ fontSize: 12.5, color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                              <span>{r.cantidad}× {r.nombre}</span>
                              {r.costo_unitario && <span>${(r.cantidad * r.costo_unitario).toLocaleString('es-AR')}</span>}
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: 10 }}>
                          {s.costo && <span className="history-cost">${s.costo.toLocaleString('es-AR')}</span>}
                          {s.km_realizado && <span className="history-date">{s.km_realizado.toLocaleString('es-AR')} km</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 12 }}>
                          <button onClick={() => abrirNuevaFactura(s)} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 12.5, fontWeight: 600, padding: 0 }}>
                            + Factura
                          </button>
                          <button onClick={() => abrirEdicionService(s)} style={{ background: 'none', border: 'none', color: '#006cb5', fontSize: 12.5, fontWeight: 600, padding: 0 }}>
                            Editar
                          </button>
                          <button onClick={() => eliminarService(s.id)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 12.5, fontWeight: 600, padding: 0 }}>
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {tab === 'facturas' && (
          <>
            {facturas.length === 0 && (
              <div className="card">
                <div className="empty-state" style={{ padding: 24 }}>
                  <div className="icon">🧾</div>
                  <p>Sin facturas registradas todavía.<br />Agregalas desde cada service en "Historial services".</p>
                </div>
              </div>
            )}

            {facturas.length > 0 && (
              <>
                <div className="card" style={{ background: '#eef4fb', borderColor: '#cbdcef' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: '#00558c', fontWeight: 600 }}>Total facturado</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: '#003d66' }}>${totalFacturado.toLocaleString('es-AR')}</span>
                  </div>
                </div>

                <div className="card">
                  {facturas.map((f) => (
                    <div key={f.id} className="history-item">
                      <div className="history-top">
                        <span>{f.numero ? `Fact. N° ${f.numero}` : 'Sin número'}</span>
                        <span className="history-date">{new Date(f.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</span>
                      </div>
                      {f.services?.descripcion && (
                        <div className="history-desc">🔧 {f.services.descripcion}</div>
                      )}
                      {f.taller && <div className="history-desc">🏪 {f.taller}</div>}
                      {f.notas && <div className="history-desc">{f.notas}</div>}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, alignItems: 'center' }}>
                        <span className="history-cost">${f.monto.toLocaleString('es-AR')}</span>
                        <button onClick={() => eliminarFactura(f.id)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 12.5, fontWeight: 600, padding: 0 }}>
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
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
      {serviceEditando && (
        <div className="modal-overlay" onClick={() => setServiceEditando(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Editar registro</h2>
              <button className="close-btn" onClick={() => setServiceEditando(null)}>✕</button>
            </div>
            <div className="field">
              <label>Tipo</label>
              <select value={serviceEditando.tipo} onChange={(e) => setServiceEditando({ ...serviceEditando, tipo: e.target.value })}>
                {TIPO_SERVICE.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Descripción</label>
              <textarea value={serviceEditando.descripcion} onChange={(e) => setServiceEditando({ ...serviceEditando, descripcion: e.target.value })} />
            </div>
            <div className="field">
              <label>Taller / proveedor</label>
              <input value={serviceEditando.taller} onChange={(e) => setServiceEditando({ ...serviceEditando, taller: e.target.value })} />
            </div>
            <div className="field">
              <label>Costo (ARS)</label>
              <input type="number" value={serviceEditando.costo} onChange={(e) => setServiceEditando({ ...serviceEditando, costo: e.target.value })} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Kilometraje</label>
              <input type="number" value={serviceEditando.km_realizado} onChange={(e) => setServiceEditando({ ...serviceEditando, km_realizado: e.target.value })} />
            </div>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={guardarEdicionService} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      )}
      {facturaParaService && (
        <div className="modal-overlay" onClick={() => setFacturaParaService(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🧾 Nueva factura</h2>
              <button className="close-btn" onClick={() => setFacturaParaService(null)}>✕</button>
            </div>
            <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 14, padding: '8px 12px', background: '#f8fafc', borderRadius: 8 }}>
              Service: {facturaParaService.descripcion}
            </div>
            <div className="field">
              <label>N° de factura</label>
              <input value={numeroFactura} onChange={(e) => setNumeroFactura(e.target.value)} placeholder="Ej: 0001-00012345" />
            </div>
            <div className="field">
              <label>Fecha de la factura</label>
              <input type="date" value={fechaFactura} onChange={(e) => setFechaFactura(e.target.value)} />
            </div>
            <div className="field">
              <label>Monto (ARS) *</label>
              <input type="number" value={montoFactura} onChange={(e) => setMontoFactura(e.target.value)} placeholder="0" />
            </div>
            <div className="field">
              <label>Taller / proveedor</label>
              <input value={tallerFactura} onChange={(e) => setTallerFactura(e.target.value)} placeholder="Ej: Taller Don José" />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Notas (opcional)</label>
              <textarea value={notasFactura} onChange={(e) => setNotasFactura(e.target.value)} placeholder="Ej: Incluye mano de obra..." />
            </div>

            <div className="field" style={{ marginTop: 14, marginBottom: 0 }}>
              <label>⚠️ Falla que se solucionó con esta factura (opcional)</label>
              <select value={fallaIdFactura} onChange={(e) => setFallaIdFactura(e.target.value)}>
                <option value="">— No vincular a ninguna falla —</option>
                {fallasPendientesFlota.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.unidades?.patente} · {f.choferes?.nombre} · {f.categoria.toUpperCase()} · {f.descripcion.slice(0, 50)}{f.descripcion.length > 50 ? '...' : ''}
                  </option>
                ))}
              </select>
              {fallasPendientesFlota.length === 0 && (
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                  No hay fallas pendientes en la flota.
                </div>
              )}
              {fallaIdFactura && (
                <div style={{ fontSize: 12, color: '#16a34a', marginTop: 4 }}>
                  ✓ Al guardar, esa falla quedará marcada como resuelta automáticamente.
                </div>
              )}
            </div>
            <button
              className="btn btn-primary"
              style={{ marginTop: 16 }}
              onClick={guardarFactura}
              disabled={guardando || !montoFactura}
            >
              {guardando ? 'Guardando...' : 'Guardar factura'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
