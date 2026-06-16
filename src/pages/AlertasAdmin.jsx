import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { TIPO_ALERTA } from '../lib/constants'
import TopBar from '../components/TopBar'

export default function AlertasAdmin() {
  const [alertas, setAlertas] = useState([])
  const [unidades, setUnidades] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNueva, setShowNueva] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const [unidadId, setUnidadId] = useState('')
  const [tipo, setTipo] = useState('cambio_aceite')
  const [descripcion, setDescripcion] = useState('')
  const [kmIntervalo, setKmIntervalo] = useState('')
  const [fechaProxima, setFechaProxima] = useState('')

  useEffect(() => {
    cargarTodo()
  }, [])

  async function cargarTodo() {
    setLoading(true)
    const [{ data: unidadesData }, { data: alertasData }] = await Promise.all([
      supabase.from('unidades').select('id, patente, km_actual').eq('activo', true).order('patente'),
      supabase.from('alertas_preventivas').select('*, unidades(patente, km_actual)').eq('activa', true).order('created_at', { ascending: false }),
    ])
    setUnidades(unidadesData || [])
    setAlertas(alertasData || [])
    setLoading(false)
  }

  async function crearAlerta() {
    if (!unidadId || !descripcion.trim()) return
    setGuardando(true)
    const unidad = unidades.find((u) => u.id === unidadId)
    const kmProximo = kmIntervalo ? (unidad?.km_actual || 0) + parseInt(kmIntervalo) : null

    await supabase.from('alertas_preventivas').insert({
      unidad_id: unidadId,
      tipo,
      descripcion: descripcion.trim(),
      km_intervalo: kmIntervalo ? parseInt(kmIntervalo) : null,
      km_proximo: kmProximo,
      fecha_proxima: fechaProxima || null,
    })

    setGuardando(false)
    setUnidadId(''); setDescripcion(''); setKmIntervalo(''); setFechaProxima('')
    setShowNueva(false)
    cargarTodo()
  }

  async function eliminarAlerta(id) {
    await supabase.from('alertas_preventivas').update({ activa: false }).eq('id', id)
    cargarTodo()
  }

  function calcularEstado(alerta) {
    const unidad = alerta.unidades
    if (alerta.km_proximo && unidad) {
      const restante = alerta.km_proximo - unidad.km_actual
      if (restante <= 0) return { label: 'Vencido', color: '#dc2626' }
      if (restante <= 1000) return { label: `Faltan ${restante} km`, color: '#d97706' }
      return { label: `Faltan ${restante} km`, color: '#16a34a' }
    }
    if (alerta.fecha_proxima) {
      const dias = Math.ceil((new Date(alerta.fecha_proxima) - new Date()) / (1000 * 60 * 60 * 24))
      if (dias <= 0) return { label: 'Vencido', color: '#dc2626' }
      if (dias <= 15) return { label: `Faltan ${dias} días`, color: '#d97706' }
      return { label: `Faltan ${dias} días`, color: '#16a34a' }
    }
    return { label: 'Sin definir', color: '#94a3b8' }
  }

  return (
    <>
      <TopBar title="🔔 Alertas preventivas" />
      <div className="content">
        {!showNueva && (
          <button className="btn btn-secondary" onClick={() => setShowNueva(true)} style={{ marginBottom: 14 }}>
            + Nueva alerta
          </button>
        )}

        {showNueva && (
          <div className="card">
            <div className="card-title">Nueva alerta de mantenimiento</div>
            <div className="field">
              <label>Unidad *</label>
              <select value={unidadId} onChange={(e) => setUnidadId(e.target.value)}>
                <option value="">Seleccionar unidad</option>
                {unidades.map((u) => <option key={u.id} value={u.id}>{u.patente}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Tipo</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                {TIPO_ALERTA.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Descripción *</label>
              <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej: Cambio de aceite y filtro" />
            </div>
            <div className="field">
              <label>Cada cuántos km (opcional)</label>
              <input type="number" value={kmIntervalo} onChange={(e) => setKmIntervalo(e.target.value)} placeholder="Ej: 10000" />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>O vence en fecha (opcional)</label>
              <input type="date" value={fechaProxima} onChange={(e) => setFechaProxima(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn btn-outline" onClick={() => setShowNueva(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={crearAlerta} disabled={guardando || !unidadId || !descripcion.trim()}>
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        )}

        {loading && <div className="loading-spinner">Cargando...</div>}

        {!loading && alertas.length === 0 && !showNueva && (
          <div className="card">
            <div className="empty-state">
              <div className="icon">🔔</div>
              <p>Sin alertas configuradas</p>
            </div>
          </div>
        )}

        {!loading && alertas.map((a) => {
          const estado = calcularEstado(a)
          const tipoInfo = TIPO_ALERTA.find((t) => t.key === a.tipo)
          return (
            <div key={a.id} className="card" style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <strong style={{ fontSize: 14 }}>{a.unidades?.patente}</strong>
                  <div style={{ fontSize: 12.5, color: '#475569', marginTop: 2 }}>
                    {tipoInfo?.label} — {a.descripcion}
                  </div>
                </div>
                <button
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 13 }}
                  onClick={() => eliminarAlerta(a.id)}
                >
                  ✕
                </button>
              </div>
              <span className="badge" style={{ background: estado.color, marginTop: 8 }}>
                {estado.label}
              </span>
            </div>
          )
        })}
      </div>
    </>
  )
}
