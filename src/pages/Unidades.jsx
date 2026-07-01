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

  // edición de unidad existente
  const [editando, setEditando] = useState(null)
  const [editPatente, setEditPatente] = useState('')
  const [editMarca, setEditMarca] = useState('')
  const [editModelo, setEditModelo] = useState('')
  const [editAnio, setEditAnio] = useState('')
  const [editChoferId, setEditChoferId] = useState('')
  const [editKm, setEditKm] = useState('')
  const [editError, setEditError] = useState('')

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

  function abrirEdicion(u, e) {
    e.stopPropagation()
    setEditando(u)
    setEditPatente(u.patente || '')
    setEditMarca(u.marca || '')
    setEditModelo(u.modelo || '')
    setEditAnio(u.anio?.toString() || '')
    setEditChoferId(u.chofer_id || '')
    setEditKm(u.km_actual?.toString() || '')
    setEditError('')
  }

  async function guardarEdicion() {
    setEditError('')
    if (!editPatente.trim()) {
      setEditError('La patente es obligatoria')
      return
    }
    setGuardando(true)
    const { error } = await supabase.from('unidades').update({
      patente: editPatente.trim().toUpperCase(),
      marca: editMarca.trim() || null,
      modelo: editModelo.trim() || null,
      anio: editAnio ? parseInt(editAnio) : null,
      chofer_id: editChoferId || null,
      km_actual: editKm ? parseInt(editKm) : 0,
    }).eq('id', editando.id)
    setGuardando(false)
    if (error) {
      setEditError(error.message.includes('duplicate') ? 'Ya existe otra unidad con esa patente' : 'Error al guardar')
      return
    }
    setEditando(null)
    invalidateUnidades()
    cargarUnidades()
  }

  async function eliminarUnidad() {
    if (!confirm(`¿Eliminar la unidad ${editando.patente}? Se deja de mostrar en la app, pero el historial de checklists y fallas pasadas queda conservado.`)) return
    setGuardando(true)
    await supabase.from('unidades').update({ activo: false }).eq('id', editando.id)
    setGuardando(false)
    setEditando(null)
    invalidateUnidades()
    cargarUnidades()
  }

  return (
    <>
      <TopBar title="🚚 Unidades" />
      <div className="content">
        {loading && <div className="loading-spinner">Cargando...</div>}

        {!loading && unidades.map((u) => (
          <div key={u.id} className="unidad-card">
            <div onClick={() => navigate(`/unidades/${u.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0, cursor: 'pointer' }}>
              <div className="unidad-avatar">🚚</div>
              <div className="unidad-info">
                <div className="unidad-patente">{u.patente}</div>
                <div className="unidad-sub">
                  {u.marca} {u.modelo} {u.anio ? `· ${u.anio}` : ''}
                </div>
                <div className="unidad-sub">👤 {u.choferes?.nombre || 'Sin chofer asignado'}</div>
              </div>
            </div>
            <span className="estado-dot" style={{
              background: u.estado === 'verde' ? '#16a34a' : u.estado === 'amarillo' ? '#d97706' : '#dc2626'
            }} />
            <button
              onClick={(e) => abrirEdicion(u, e)}
              style={{
                background: '#f1f5f9', border: 'none', borderRadius: 10,
                padding: '8px 12px', fontSize: 13, fontWeight: 600, color: '#475569', marginLeft: 8,
              }}
            >
              ✏️ Editar
            </button>
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

      {editando && (
        <div className="modal-overlay" onClick={() => setEditando(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Editar unidad</h2>
              <button className="close-btn" onClick={() => setEditando(null)}>✕</button>
            </div>
            {editError && (
              <div style={{ background: '#fef2f2', color: '#dc2626', padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
                {editError}
              </div>
            )}
            <div className="field">
              <label>Patente *</label>
              <input value={editPatente} onChange={(e) => setEditPatente(e.target.value)} placeholder="Ej: AB123CD" />
            </div>
            <div className="field">
              <label>Marca</label>
              <input value={editMarca} onChange={(e) => setEditMarca(e.target.value)} placeholder="Ej: Mercedes-Benz" />
            </div>
            <div className="field">
              <label>Modelo</label>
              <input value={editModelo} onChange={(e) => setEditModelo(e.target.value)} placeholder="Ej: Sprinter" />
            </div>
            <div className="field">
              <label>Año</label>
              <input type="number" value={editAnio} onChange={(e) => setEditAnio(e.target.value)} placeholder="Ej: 2020" />
            </div>
            <div className="field">
              <label>Chofer asignado</label>
              <select value={editChoferId} onChange={(e) => setEditChoferId(e.target.value)}>
                <option value="">Sin asignar</option>
                {choferes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Kilometraje actual</label>
              <input type="number" value={editKm} onChange={(e) => setEditKm(e.target.value)} placeholder="0" />
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button className="btn btn-outline" onClick={() => setEditando(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarEdicion} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
            <button
              onClick={eliminarUnidad}
              style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 13, fontWeight: 600, marginTop: 14, padding: 0 }}
            >
              🗑️ Eliminar esta unidad
            </button>
          </div>
        </div>
      )}
    </>
  )
}
