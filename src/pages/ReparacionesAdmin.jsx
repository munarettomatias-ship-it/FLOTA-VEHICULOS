import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { TIPO_SERVICE } from '../lib/constants'
import TopBar from '../components/TopBar'

export default function ReparacionesAdmin() {
  const navigate = useNavigate()
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroUnidad, setFiltroUnidad] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [unidades, setUnidades] = useState([])

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setLoading(true)
    const [{ data: servicesData }, { data: unidadesData }] = await Promise.all([
      supabase
        .from('services')
        .select('*, unidades(patente, marca, modelo), repuestos_service(*)')
        .order('fecha', { ascending: false }),
      supabase
        .from('unidades')
        .select('id, patente, marca, modelo')
        .eq('activo', true)
        .order('patente'),
    ])
    setServices(servicesData || [])
    setUnidades(unidadesData || [])
    setLoading(false)
  }

  const serviciosFiltrados = services.filter((s) => {
    const matchUnidad = !filtroUnidad || s.unidad_id === filtroUnidad
    const matchTipo = !filtroTipo || s.tipo === filtroTipo
    const texto = busqueda.toLowerCase()
    const matchBusqueda = !busqueda ||
      s.descripcion?.toLowerCase().includes(texto) ||
      s.taller?.toLowerCase().includes(texto) ||
      s.unidades?.patente?.toLowerCase().includes(texto)
    return matchUnidad && matchTipo && matchBusqueda
  })

  const totalFiltrado = serviciosFiltrados.reduce((acc, s) => acc + (s.costo || 0), 0)

  return (
    <>
      <TopBar title="🔧 Reparaciones" subtitle="Historial completo de flota" />
      <div className="content">
        {/* Filtros */}
        <div className="card" style={{ marginBottom: 14 }}>
          <input
            placeholder="🔍 Buscar por descripción, taller o patente..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', marginBottom: 10, fontSize: 14 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={filtroUnidad}
              onChange={(e) => setFiltroUnidad(e.target.value)}
              style={{ flex: 1, padding: 10, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13 }}
            >
              <option value="">Todas las unidades</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>{u.patente} — {u.marca} {u.modelo}</option>
              ))}
            </select>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              style={{ flex: 1, padding: 10, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13 }}
            >
              <option value="">Todos los tipos</option>
              {TIPO_SERVICE.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
        </div>

        {loading && <div className="loading-spinner">Cargando...</div>}

        {!loading && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '0 2px' }}>
              <span style={{ fontSize: 13, color: '#475569' }}>
                {serviciosFiltrados.length} registro{serviciosFiltrados.length !== 1 ? 's' : ''}
              </span>
              {totalFiltrado > 0 && (
                <span style={{ fontSize: 14, fontWeight: 700, color: '#003d66' }}>
                  Total: ${totalFiltrado.toLocaleString('es-AR')}
                </span>
              )}
            </div>

            {serviciosFiltrados.length === 0 && (
              <div className="card">
                <div className="empty-state" style={{ padding: 24 }}>
                  <div className="icon">🔧</div>
                  <p>No hay reparaciones que coincidan con el filtro.</p>
                </div>
              </div>
            )}

            {serviciosFiltrados.length > 0 && (
              <div className="card">
                {serviciosFiltrados.map((s) => (
                  <div
                    key={s.id}
                    className="history-item"
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/unidades/${s.unidad_id}`)}
                  >
                    <div className="history-top">
                      <span style={{ fontWeight: 700, color: '#003d66' }}>
                        {s.unidades?.patente}
                      </span>
                      <span className="history-date">{new Date(s.fecha).toLocaleDateString('es-AR')}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4, marginBottom: 4 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
                        background: '#eef4fb', color: '#00558c',
                      }}>
                        {TIPO_SERVICE.find((t) => t.key === s.tipo)?.label}
                      </span>
                      {s.taller && (
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 100, background: '#f1f5f9', color: '#475569' }}>
                          🏪 {s.taller}
                        </span>
                      )}
                    </div>
                    <div className="history-desc">{s.descripcion}</div>

                    {s.repuestos_service?.length > 0 && (
                      <div style={{ marginTop: 6, paddingLeft: 10, borderLeft: '2px solid #e2e8f0' }}>
                        {s.repuestos_service.map((r) => (
                          <div key={r.id} style={{ fontSize: 12, color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                            <span>{r.cantidad}× {r.nombre}</span>
                            {r.costo_unitario && <span>${(r.cantidad * r.costo_unitario).toLocaleString('es-AR')}</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                      {s.costo
                        ? <span className="history-cost">${s.costo.toLocaleString('es-AR')}</span>
                        : <span />
                      }
                      {s.km_realizado && (
                        <span className="history-date">{s.km_realizado.toLocaleString('es-AR')} km</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
