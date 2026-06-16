import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getUnidades, getChoferes, invalidateUnidades } from '../lib/cache'
import TopBar from '../components/TopBar'

export default function Unidades() {
  const navigate = useNavigate()
  const [unidades, setUnidades] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNueva, setShowNueva] = useState(false)
  const [choferes, setChoferes] = useState([])

  const [patente, setPatente] = useState('')
  const [marca, setMarca] = useState('')
  const [modelo, setModelo] = useState('')
  const [anio, setAnio] = useState('')
  const [choferId, setChoferId] = useState('')
  const [kmInicial, setKmInicial] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    cargarUnidades()
    cargarChoferes()
  }, [])

  async function cargarUnidades() {
    setLoading(true)
    const data = await getUnidades()
    setUnidades(data)
    setLoading(false)
  }

  async function cargarChoferes() {
    const data = await getChoferes()
    setChoferes(data)
  }

  async function crearUnidad() {
    setErrorMsg('')
    if (!patente.trim()) {
      setErrorMsg('La patente es obligatoria')
      return
    }
    setGuardando(true)
    const { error } = await supabase.from('unidades').insert({
      patente: patente.trim().toUpperCase(),
      marca: marca.trim() || null,
      modelo: modelo.trim() || null,
      anio: anio ? parseInt(anio) : null,
      chofer_id: choferId || null,
      km_actual: kmInicial ? parseInt(kmInicial) : 0,
    })
    setGuardando(false)
    if (error) {
      setErrorMsg(error.message.includes('duplicate') ? 'Ya existe una unidad con esa patente' : 'Error al guardar')
      return
    }
    setPatente(''); setMarca(''); setModelo(''); setAnio(''); setChoferId(''); setKmInicial('')
    setShowNueva(false)
    invalidateUnidades()
    cargarUnidades()
  }

  return (
    <>
      <TopBar title="🚚 Unidades" />
      <div className="content">
        {loading && <div className="loading-spinner">Cargando...</div>}

        {!loading && unidades.map((u) => (
          <div key={u.id} className="unidad-card" onClick={() => navigate(`/unidades/${u.id}`)} style={{ cursor: 'pointer' }}>
            <div className="unidad-avatar">🚚</div>
            <div className="unidad-info">
              <div className="unidad-patente">{u.patente}</div>
              <div className="unidad-sub">
                {u.marca} {u.modelo} {u.anio ? `· ${u.anio}` : ''}
              </div>
              <div className="unidad-sub">👤 {u.choferes?.nombre || 'Sin chofer asignado'}</div>
            </div>
            <span className="estado-dot" style={{
              background: u.estado === 'verde' ? '#16a34a' : u.estado === 'amarillo' ? '#d97706' : '#dc2626'
            }} />
          </div>
        ))}

        {!loading && unidades.length === 0 && !showNueva && (
          <div className="card">
            <div className="empty-state">
              <div className="icon">🚚</div>
              <p>Todavía no agregaste unidades</p>
            </div>
          </div>
        )}

        {!showNueva && (
          <button className="btn btn-secondary" onClick={() => setShowNueva(true)} style={{ marginTop: 8 }}>
            + Agregar unidad
          </button>
        )}

        {showNueva && (
          <div className="card" style={{ marginTop: 10 }}>
            <div className="card-title">Nueva unidad</div>
            {errorMsg && (
              <div style={{ background: '#fef2f2', color: '#dc2626', padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
                {errorMsg}
              </div>
            )}
            <div className="field">
              <label>Patente *</label>
              <input value={patente} onChange={(e) => setPatente(e.target.value)} placeholder="Ej: AB123CD" />
            </div>
            <div className="field">
              <label>Marca</label>
              <input value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Ej: Mercedes-Benz" />
            </div>
            <div className="field">
              <label>Modelo</label>
              <input value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="Ej: Sprinter" />
            </div>
            <div className="field">
              <label>Año</label>
              <input type="number" value={anio} onChange={(e) => setAnio(e.target.value)} placeholder="Ej: 2020" />
            </div>
            <div className="field">
              <label>Chofer asignado</label>
              <select value={choferId} onChange={(e) => setChoferId(e.target.value)}>
                <option value="">Sin asignar</option>
                {choferes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Kilometraje inicial</label>
              <input type="number" value={kmInicial} onChange={(e) => setKmInicial(e.target.value)} placeholder="0" />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn btn-outline" onClick={() => { setShowNueva(false); setErrorMsg('') }}>Cancelar</button>
              <button className="btn btn-primary" onClick={crearUnidad} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
