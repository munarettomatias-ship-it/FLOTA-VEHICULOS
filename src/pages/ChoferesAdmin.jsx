import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getChoferes, invalidateChoferes, invalidateUnidades } from '../lib/cache'
import TopBar from '../components/TopBar'

export default function ChoferesAdmin() {
  const [choferes, setChoferes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNuevo, setShowNuevo] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [editando, setEditando] = useState(null)
  const [editNombre, setEditNombre] = useState('')
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setLoading(true)
    const data = await getChoferes({ force: true })
    setChoferes(data)
    setLoading(false)
  }

  async function crearChofer() {
    if (!nuevoNombre.trim()) return
    setGuardando(true)
    const { error } = await supabase.from('choferes').insert({ nombre: nuevoNombre.trim() })
    setGuardando(false)
    if (!error) {
      setNuevoNombre('')
      setShowNuevo(false)
      invalidateChoferes()
      cargar()
    }
  }

  function abrirEdicion(c) {
    setEditando(c)
    setEditNombre(c.nombre)
  }

  async function guardarEdicion() {
    if (!editNombre.trim()) return
    setGuardando(true)
    await supabase.from('choferes').update({ nombre: editNombre.trim() }).eq('id', editando.id)
    setGuardando(false)
    setEditando(null)
    invalidateChoferes()
    cargar()
  }

  async function eliminarChofer(chofer) {
    if (!confirm(`¿Eliminar a ${chofer.nombre} de la lista?`)) return

    // Verificamos si tiene historial asociado (checklists o fallas).
    // Si tiene, no se puede borrar sin romper esos registros: se desactiva
    // en su lugar para conservar el historial pasado.
    const [{ count: checklistsCount }, { count: fallasCount }] = await Promise.all([
      supabase.from('checklists').select('*', { count: 'exact', head: true }).eq('chofer_id', chofer.id),
      supabase.from('reportes_fallas').select('*', { count: 'exact', head: true }).eq('chofer_id', chofer.id),
    ])

    const tieneHistorial = (checklistsCount || 0) > 0 || (fallasCount || 0) > 0

    // Si tenía una unidad asignada, la desvinculamos en cualquier caso.
    await supabase.from('unidades').update({ chofer_id: null }).eq('chofer_id', chofer.id)
    invalidateUnidades()

    if (tieneHistorial) {
      await supabase.from('choferes').update({ activo: false }).eq('id', chofer.id)
      setAviso(`${chofer.nombre} tiene checklists/fallas registradas, así que se desactivó (no aparece más en la lista) pero se conservó su historial.`)
    } else {
      await supabase.from('choferes').delete().eq('id', chofer.id)
      setAviso(`${chofer.nombre} fue eliminado definitivamente.`)
    }

    invalidateChoferes()
    cargar()
    setTimeout(() => setAviso(''), 5000)
  }

  return (
    <>
      <TopBar title="👨‍✈️ Choferes" />
      <div className="content">
        {aviso && (
          <div className="card" style={{ background: '#fff7ed', borderColor: '#fed7aa', fontSize: 13, color: '#c2410c' }}>
            {aviso}
          </div>
        )}

        {!showNuevo ? (
          <button className="btn btn-secondary" onClick={() => setShowNuevo(true)} style={{ marginBottom: 14 }}>
            + Agregar chofer
          </button>
        ) : (
          <div className="card">
            <div className="field" style={{ marginBottom: 10 }}>
              <label>Nombre y apellido</label>
              <input value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} placeholder="Ej: Carlos Gómez" autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" onClick={() => { setShowNuevo(false); setNuevoNombre('') }}>Cancelar</button>
              <button className="btn btn-primary" onClick={crearChofer} disabled={guardando || !nuevoNombre.trim()}>
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        )}

        {loading && <div className="loading-spinner">Cargando...</div>}

        {!loading && choferes.length === 0 && (
          <div className="card">
            <div className="empty-state">
              <div className="icon">👤</div>
              <p>No hay choferes registrados todavía.</p>
            </div>
          </div>
        )}

        {!loading && choferes.map((c) => (
          <div key={c.id} className="unidad-card">
            <div className="unidad-avatar">👨‍✈️</div>
            <div className="unidad-info">
              <div className="unidad-patente">{c.nombre}</div>
              <div className="unidad-sub">Alta: {new Date(c.created_at).toLocaleDateString('es-AR')}</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => abrirEdicion(c)} style={{ background: 'none', border: 'none', color: '#006cb5', fontSize: 13, fontWeight: 600 }}>
                Editar
              </button>
              <button onClick={() => eliminarChofer(c)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 13, fontWeight: 600 }}>
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>

      {editando && (
        <div className="modal-overlay" onClick={() => setEditando(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Editar chofer</h2>
              <button className="close-btn" onClick={() => setEditando(null)}>✕</button>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Nombre y apellido</label>
              <input value={editNombre} onChange={(e) => setEditNombre(e.target.value)} autoFocus />
            </div>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={guardarEdicion} disabled={guardando || !editNombre.trim()}>
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
