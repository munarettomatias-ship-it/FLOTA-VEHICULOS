import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { TIPOS_COMBUSTIBLE, ESTACIONES } from '../lib/constants'
import TopBar from '../components/TopBar'

export default function CombustibleAdmin() {
  const [cargas, setCargas] = useState([])
  const [unidades, setUnidades] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroUnidad, setFiltroUnidad] = useState('')
  const [filtroEstacion, setFiltroEstacion] = useState('')
  const [filtroPeriodo, setFiltroPeriodo] = useState('30') // días

  useEffect(() => {
    cargar()
  }, [filtroPeriodo])

  async function cargar() {
    setLoading(true)
    const desde = new Date()
    desde.setDate(desde.getDate() - parseInt(filtroPeriodo))

    const [{ data: cargasData }, { data: unidadesData }] = await Promise.all([
      supabase
        .from('cargas_combustible')
        .select('*, unidades(patente, marca, modelo), choferes(nombre)')
        .gte('fecha', desde.toISOString())
        .order('fecha', { ascending: false }),
      supabase
        .from('unidades')
        .select('id, patente, marca, modelo')
        .eq('activo', true)
        .order('patente'),
    ])
    setCargas(cargasData || [])
    setUnidades(unidadesData || [])
    setLoading(false)
  }

  const cargasFiltradas = cargas.filter((c) => {
    const matchUnidad = !filtroUnidad || c.unidad_id === filtroUnidad
    const matchEstacion = !filtroEstacion || c.estacion === filtroEstacion
    return matchUnidad && matchEstacion
  })

  // Stats del filtro actual
  const totalLitros = cargasFiltradas.reduce((acc, c) => acc + (c.litros || 0), 0)
  const totalGasto = cargasFiltradas.reduce((acc, c) => acc + (c.costo_total || 0), 0)
  const promedioPxL = totalLitros > 0 ? (totalGasto / totalLitros).toFixed(2) : null

  // Agrupado por unidad para el resumen
  const porUnidad = {}
  cargasFiltradas.forEach((c) => {
    const pat = c.unidades?.patente || c.unidad_id
    if (!porUnidad[pat]) porUnidad[pat] = { litros: 0, gasto: 0, cargas: 0 }
    porUnidad[pat].litros += c.litros || 0
    porUnidad[pat].gasto += c.costo_total || 0
    porUnidad[pat].cargas += 1
  })

  return (
    <>
      <TopBar title="⛽ Combustible" subtitle="Control de flota" />
      <div className="content">

        {/* Filtros */}
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {[
              { key: '7', label: '7 días' },
              { key: '30', label: '30 días' },
              { key: '90', label: '90 días' },
            ].map((p) => (
              <button
                key={p.key}
                className={`tab-btn ${filtroPeriodo === p.key ? 'active' : ''}`}
                onClick={() => setFiltroPeriodo(p.key)}
                style={{ flex: 1 }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={filtroUnidad}
              onChange={(e) => setFiltroUnidad(e.target.value)}
              style={{ flex: 1, padding: 10, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13 }}
            >
              <option value="">Todas las unidades</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>{u.patente}</option>
              ))}
            </select>
            <select
              value={filtroEstacion}
              onChange={(e) => setFiltroEstacion(e.target.value)}
              style={{ flex: 1, padding: 10, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13 }}
            >
              <option value="">Shell + YPF</option>
              <option value="shell">🔴 Shell</option>
              <option value="ypf">🔵 YPF</option>
            </select>
          </div>
        </div>

        {loading && <div className="loading-spinner">Cargando...</div>}

        {!loading && (
          <>
            {/* Stats generales */}
            <div className="stat-grid" style={{ marginBottom: 14 }}>
              <div className="stat-box">
                <div className="stat-icon">🛢️</div>
                <div className="num">{totalLitros.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</div>
                <div className="lbl">Litros totales</div>
              </div>
              <div className="stat-box">
                <div className="stat-icon">💰</div>
                <div className="num" style={{ fontSize: 20 }}>${totalGasto.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</div>
                <div className="lbl">Total gastado</div>
              </div>
              <div className="stat-box">
                <div className="stat-icon">📊</div>
                <div className="num" style={{ fontSize: 20 }}>{promedioPxL ? `$${promedioPxL}` : '—'}</div>
                <div className="lbl">Precio/litro prom.</div>
              </div>
              <div className="stat-box">
                <div className="stat-icon">🔄</div>
                <div className="num">{cargasFiltradas.length}</div>
                <div className="lbl">Cargas realizadas</div>
              </div>
            </div>

            {/* Resumen por unidad */}
            {Object.keys(porUnidad).length > 1 && (
              <>
                <div className="section-label">Resumen por unidad</div>
                <div className="card" style={{ marginBottom: 14 }}>
                  {Object.entries(porUnidad).map(([patente, datos]) => (
                    <div key={patente} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#003d66' }}>🚚 {patente}</div>
                        <div style={{ fontSize: 12.5, color: '#64748b' }}>{datos.cargas} carga{datos.cargas !== 1 ? 's' : ''} · {datos.litros.toFixed(1)} L</div>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#003d66' }}>
                        ${datos.gasto.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Listado detallado */}
            <div className="section-label">Detalle de cargas</div>

            {cargasFiltradas.length === 0 && (
              <div className="card">
                <div className="empty-state" style={{ padding: 24 }}>
                  <div className="icon">⛽</div>
                  <p>Sin cargas registradas en este período.</p>
                </div>
              </div>
            )}

            {cargasFiltradas.length > 0 && (
              <div className="card">
                {cargasFiltradas.map((c) => {
                  const tipo = TIPOS_COMBUSTIBLE.find((t) => t.key === c.tipo_combustible)
                  const pxl = c.litros ? (c.costo_total / c.litros).toFixed(2) : null
                  return (
                    <div key={c.id} className="history-item">
                      <div className="history-top">
                        <span style={{ fontWeight: 700, color: '#003d66' }}>
                          🚚 {c.unidades?.patente}
                        </span>
                        <span className="history-date">
                          {new Date(c.fecha).toLocaleDateString('es-AR')} {new Date(c.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: '#475569', marginTop: 3 }}>
                        👤 {c.choferes?.nombre} · {c.estacion === 'shell' ? '🔴 Shell' : '🔵 YPF'} · {tipo?.label}
                      </div>
                      <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, color: '#475569' }}>🛢️ {c.litros} L</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#003d66' }}>${c.costo_total.toLocaleString('es-AR')}</span>
                        {pxl && <span style={{ fontSize: 13, color: '#94a3b8' }}>${pxl}/L</span>}
                        {c.km_actual && <span style={{ fontSize: 13, color: '#94a3b8' }}>📍 {c.km_actual.toLocaleString('es-AR')} km</span>}
                      </div>
                      {c.notas && <div className="history-desc" style={{ marginTop: 4 }}>{c.notas}</div>}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
