import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/SessionContext'
import { getUnidadDeChofer } from '../lib/cache'
import { TIPOS_COMBUSTIBLE, ESTACIONES } from '../lib/constants'
import TopBar from '../components/TopBar'

export default function CombustibleChofer() {
  const { session } = useSession()
  const [unidad, setUnidad] = useState(null)
  const [cargas, setCargas] = useState([])
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [exito, setExito] = useState(false)

  // form
  const [estacion, setEstacion] = useState('shell')
  const [tipoCombustible, setTipoCombustible] = useState('vpower_nafta')
  const [litros, setLitros] = useState('')
  const [costoTotal, setCostoTotal] = useState('')
  const [kmActual, setKmActual] = useState('')
  const [notas, setNotas] = useState('')
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setLoading(true)
    const unidadData = await getUnidadDeChofer(session.id)
    setUnidad(unidadData)
    if (unidadData) {
      setKmActual(unidadData.km_actual?.toString() || '')
      const { data } = await supabase
        .from('cargas_combustible')
        .select('*')
        .eq('chofer_id', session.id)
        .order('fecha', { ascending: false })
        .limit(30)
      setCargas(data || [])
    }
    setLoading(false)
  }

  // Cuando cambia la estación, resetea al primer combustible disponible de esa estación
  function cambiarEstacion(nueva) {
    setEstacion(nueva)
    const primero = TIPOS_COMBUSTIBLE.find((t) => t.estacion === nueva)
    if (primero) setTipoCombustible(primero.key)
  }

  async function guardarCarga() {
    if (!unidad || !litros || !costoTotal) return
    setGuardando(true)

    const [anio, mes, dia] = fecha.split('-').map(Number)
    const ahora = new Date()
    const fechaConHora = new Date(anio, mes - 1, dia, ahora.getHours(), ahora.getMinutes())

    await supabase.from('cargas_combustible').insert({
      unidad_id: unidad.id,
      chofer_id: session.id,
      fecha: fechaConHora.toISOString(),
      tipo_combustible: tipoCombustible,
      estacion,
      litros: parseFloat(litros),
      costo_total: parseFloat(costoTotal),
      km_actual: kmActual ? parseInt(kmActual) : null,
      notas: notas.trim() || null,
    })

    // Actualizar km si el chofer lo ingresó
    if (kmActual && parseInt(kmActual) > (unidad.km_actual || 0)) {
      await supabase.from('unidades').update({ km_actual: parseInt(kmActual) }).eq('id', unidad.id)
    }

    setGuardando(false)
    setShowForm(false)
    setLitros(''); setCostoTotal(''); setNotas('')
    setFecha(new Date().toISOString().slice(0, 10))
    setExito(true)
    setTimeout(() => setExito(false), 3000)
    cargar()
  }

  const tipoCombustiblesFiltrados = TIPOS_COMBUSTIBLE.filter((t) => t.estacion === estacion)
  const costoPorLitro = litros && costoTotal
    ? (parseFloat(costoTotal) / parseFloat(litros)).toFixed(2)
    : null

  // Stats del historial
  const totalLitros = cargas.reduce((acc, c) => acc + (c.litros || 0), 0)
  const totalGastado = cargas.reduce((acc, c) => acc + (c.costo_total || 0), 0)

  if (loading) return (
    <>
      <TopBar title="⛽ Combustible" />
      <div className="loading-spinner">Cargando...</div>
    </>
  )

  if (!unidad) return (
    <>
      <TopBar title="⛽ Combustible" />
      <div className="content">
        <div className="card">
          <div className="empty-state">
            <div className="icon">🚫</div>
            <p>Primero elegí tu camión desde el Inicio.</p>
          </div>
        </div>
      </div>
    </>
  )

  return (
    <>
      <TopBar title="⛽ Combustible" subtitle={`Patente ${unidad.patente}`} />
      <div className="content">

        {exito && (
          <div className="card" style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#16a34a', fontWeight: 600, fontSize: 14 }}>
            ✓ Carga registrada correctamente
          </div>
        )}

        {/* Resumen rápido */}
        {cargas.length > 0 && (
          <div className="stat-grid" style={{ marginBottom: 14 }}>
            <div className="stat-box">
              <div className="stat-icon">🛢️</div>
              <div className="num">{totalLitros.toLocaleString('es-AR', { maximumFractionDigits: 1 })}</div>
              <div className="lbl">Litros totales</div>
            </div>
            <div className="stat-box">
              <div className="stat-icon">💰</div>
              <div className="num" style={{ fontSize: 20 }}>${totalGastado.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</div>
              <div className="lbl">Total gastado</div>
            </div>
          </div>
        )}

        {/* Botón nueva carga */}
        {!showForm && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)} style={{ marginBottom: 16 }}>
            ⛽ Registrar carga de combustible
          </button>
        )}

        {/* Formulario */}
        {showForm && (
          <div className="card">
            <div className="card-title">Nueva carga</div>

            <div className="field">
              <label>Fecha</label>
              <input type="date" value={fecha} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setFecha(e.target.value)} />
            </div>

            {/* Selector de estación */}
            <div className="field">
              <label>Estación</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {ESTACIONES.map((e) => (
                  <button
                    key={e.key}
                    type="button"
                    onClick={() => cambiarEstacion(e.key)}
                    style={{
                      flex: 1, padding: '14px 10px', borderRadius: 14, border: 'none',
                      fontWeight: 700, fontSize: 15, cursor: 'pointer',
                      background: estacion === e.key
                        ? (e.key === 'shell' ? '#dc2626' : '#1d4ed8')
                        : '#f1f5f9',
                      color: estacion === e.key ? 'white' : '#475569',
                      transition: 'all 0.15s',
                    }}
                  >
                    {e.key === 'shell' ? '🔴 Shell' : '🔵 YPF'}
                  </button>
                ))}
              </div>
            </div>

            {/* Tipo de combustible */}
            <div className="field">
              <label>Tipo de combustible</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tipoCombustiblesFiltrados.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTipoCombustible(t.key)}
                    style={{
                      padding: '13px 16px', borderRadius: 12, fontWeight: 600, fontSize: 15,
                      textAlign: 'left', border: '1.5px solid',
                      borderColor: tipoCombustible === t.key ? '#006cb5' : '#e2e8f0',
                      background: tipoCombustible === t.key ? '#eef4fb' : 'white',
                      color: tipoCombustible === t.key ? '#003d66' : '#475569',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Litros</label>
                <input type="number" step="0.01" value={litros} onChange={(e) => setLitros(e.target.value)} placeholder="Ej: 45.5" />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Costo total ($)</label>
                <input type="number" value={costoTotal} onChange={(e) => setCostoTotal(e.target.value)} placeholder="Ej: 28500" />
              </div>
            </div>

            {/* Precio por litro calculado en tiempo real */}
            {costoPorLitro && (
              <div style={{ fontSize: 13, color: '#006cb5', fontWeight: 600, marginTop: -8, marginBottom: 14 }}>
                → ${costoPorLitro} por litro
              </div>
            )}

            <div className="field">
              <label>Km actuales del vehículo (opcional)</label>
              <input type="number" value={kmActual} onChange={(e) => setKmActual(e.target.value)} placeholder={unidad.km_actual?.toString()} />
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <label>Notas (opcional)</label>
              <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej: Tanque lleno" />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancelar</button>
              <button
                className="btn btn-primary"
                onClick={guardarCarga}
                disabled={guardando || !litros || !costoTotal}
              >
                {guardando ? 'Guardando...' : 'Guardar carga'}
              </button>
            </div>
          </div>
        )}

        {/* Historial de cargas */}
        {cargas.length === 0 && !showForm && (
          <div className="card">
            <div className="empty-state" style={{ padding: 30 }}>
              <div className="icon">⛽</div>
              <p>Todavía no registraste ninguna carga.</p>
            </div>
          </div>
        )}

        {cargas.length > 0 && (
          <div className="card">
            {cargas.map((c) => {
              const tipo = TIPOS_COMBUSTIBLE.find((t) => t.key === c.tipo_combustible)
              const pxl = c.litros ? (c.costo_total / c.litros).toFixed(2) : null
              return (
                <div key={c.id} className="history-item">
                  <div className="history-top">
                    <span style={{ fontWeight: 700, color: '#003d66' }}>
                      {c.estacion === 'shell' ? '🔴 Shell' : '🔵 YPF'} · {tipo?.label || c.tipo_combustible}
                    </span>
                    <span className="history-date">
                      {new Date(c.fecha).toLocaleDateString('es-AR')}
                    </span>
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
      </div>
    </>
  )
}
