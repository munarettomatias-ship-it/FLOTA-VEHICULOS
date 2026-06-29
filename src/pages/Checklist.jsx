import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/SessionContext'
import { CHECKLIST_ITEMS } from '../lib/constants'
import { getUnidadDeChofer, invalidateUnidades } from '../lib/cache'
import TopBar from '../components/TopBar'

export default function Checklist() {
  const { session } = useSession()
  const navigate = useNavigate()
  const [unidad, setUnidad] = useState(null)
  const [items, setItems] = useState({})
  const [km, setKm] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    cargarUnidad()
  }, [])

  async function cargarUnidad() {
    const data = await getUnidadDeChofer(session.id)
    setUnidad(data)
    if (data) setKm(data.km_actual?.toString() || '')

    const initial = {}
    CHECKLIST_ITEMS.forEach((item) => { initial[item.key] = 'ok' })
    setItems(initial)
    setLoading(false)
  }

  function setItemEstado(key, estado) {
    setItems((prev) => ({ ...prev, [key]: estado }))
  }

  async function guardarChecklist() {
    if (!unidad) return
    setGuardando(true)

    const tieneFallas = Object.values(items).some((v) => v === 'falla')
    const kmNum = parseInt(km) || unidad.km_actual

    // Si el chofer eligió una fecha distinta a hoy, conservamos la hora
    // actual para esa fecha (no tiene sentido fijar siempre medianoche,
    // pero tampoco hace falta pedir la hora exacta).
    const ahora = new Date()
    const [anio, mes, dia] = fecha.split('-').map(Number)
    const fechaConHora = new Date(anio, mes - 1, dia, ahora.getHours(), ahora.getMinutes(), ahora.getSeconds())

    const { error } = await supabase.from('checklists').insert({
      unidad_id: unidad.id,
      chofer_id: session.id,
      km: kmNum,
      items,
      observaciones: observaciones.trim() || null,
      tiene_fallas: tieneFallas,
      fecha: fechaConHora.toISOString(),
    })

    if (!error) {
      await supabase.from('unidades').update({ km_actual: kmNum }).eq('id', unidad.id)
      invalidateUnidades()
    }

    setGuardando(false)
    if (!error) {
      if (tieneFallas) {
        navigate('/reportar', { state: { desdeChecklist: true } })
      } else {
        navigate('/')
      }
    }
  }

  if (loading) {
    return (
      <>
        <TopBar title="✅ Checklist" />
        <div className="loading-spinner">Cargando...</div>
      </>
    )
  }

  if (!unidad) {
    return (
      <>
        <TopBar title="✅ Checklist" />
        <div className="content">
          <div className="card">
            <div className="empty-state">
              <div className="icon">🚫</div>
              <p>No tenés una unidad asignada.</p>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <TopBar title="✅ Checklist diario" subtitle={`Patente ${unidad.patente}`} />
      <div className="content">
        <div className="card">
          <div className="field" style={{ marginBottom: 10 }}>
            <label>Fecha del checklist</label>
            <input
              type="date"
              value={fecha}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Kilometraje actual</label>
            <input
              type="number"
              value={km}
              onChange={(e) => setKm(e.target.value)}
              placeholder="Ej: 125400"
            />
          </div>
        </div>

        <div className="card">
          <div className="card-title">Estado del vehículo</div>
          {CHECKLIST_ITEMS.map((item) => (
            <div key={item.key} className="checklist-item">
              <div className="checklist-item-label">
                <span className="checklist-item-icon">{item.icon}</span>
                {item.label}
              </div>
              <div className="toggle-group">
                <button
                  className={`toggle-btn ${items[item.key] === 'ok' ? 'active-ok' : ''}`}
                  onClick={() => setItemEstado(item.key, 'ok')}
                >
                  OK
                </button>
                <button
                  className={`toggle-btn ${items[item.key] === 'falla' ? 'active-falla' : ''}`}
                  onClick={() => setItemEstado(item.key, 'falla')}
                >
                  Falla
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Observaciones generales (opcional)</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Cualquier comentario adicional..."
            />
          </div>
        </div>

        <button className="btn btn-primary" onClick={guardarChecklist} disabled={guardando}>
          {guardando ? 'Guardando...' : 'Guardar checklist'}
        </button>
      </div>
    </>
  )
}
