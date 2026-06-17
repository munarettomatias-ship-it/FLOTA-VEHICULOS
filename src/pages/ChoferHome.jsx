import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { invalidateChoferes } from '../lib/cache'
import TopBar from '../components/TopBar'

export default function ChoferHome() {
  const navigate = useNavigate()
  const [choferes, setChoferes] = useState([])
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [nombre, setNombre] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    cargarChoferes()
  }, [])

  async function cargarChoferes() {
    setLoading(true)
    const { data } = await supabase
      .from('choferes')
      .select('*')
      .eq('activo', true)
      .order('nombre')
    setChoferes(data || [])
    setLoading(false)
  }

  async function login(chofer) {
    // Simulamos una sesión guardando en localStorage
    localStorage.setItem('chofer_flota', JSON.stringify(chofer))
    // Navegamos a la pantalla principal del chofer
    navigate('/chofer/mis-unidades')
  }

  async function guardarChofer() {
    if (!nombre.trim()) return
    setGuardando(true)
    const { data, error } = await supabase
      .from('choferes')
      .insert({ nombre: nombre.trim() })
      .select()
      .single()
    
    if (!error) {
      setNombre('')
      setShowForm(false)
      cargarChoferes()
      invalidateChoferes()
    }
    setGuardando(false)
  }

  return (
    <>
      <TopBar title="Control de Flota" />
      <div className="content" style={{ padding: '24px 16px', background: '#e0f2f1', minHeight: 'calc(100vh - 60px)' }}>
        
        {/* ENCABEZADO Y TEXTO DE INSTRUCCIÓN */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🚛</div>
          <h1 style={{ fontSize: 24, fontWeight: 'bold', color: '#0f172a', marginBottom: 8 }}>
            Control de Flota
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', maxWidth: '300px', margin: '0 auto' }}>
            Seleccioná tu perfil de chofer para continuar y gestionar tus unidades.
          </p>
        </div>

        {/* LISTADO DE CHOFERES EXISTENTES */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: '480px', margin: '0 auto' }}>
          {choferes.map((c) => (
            <div 
              key={c.id} 
              onClick={() => login(c)}
              className="card" 
              style={{ 
                margin: 0, 
                padding: '16px 20px', 
                borderLeft: '5px solid #10b981', // Borde verde para preventivo/activo
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                cursor: 'pointer',
                backgroundColor: '#fff',
                transition: 'all 0.2s',
                ':hover': { boxShadow: '0 4px 6px rgba(0,0,0,0.1)' } // Micro-interacción
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20 }}>👤</span>
                <span style={{ fontSize: 16, fontWeight: '500', color: '#1e293b' }}>{c.nombre}</span>
              </div>
              <span style={{ color: '#94a3b8', fontSize: 18 }}>›</span>
            </div>
          ))}

          {/* CASO: NO HAY CHOFERES */}
          {choferes.length === 0 && !loading && (
            <div className="card">
              <p style={{ textAling: 'center', color: '#94a3b8', fontSize: 14 }}>
                Aún no hay choferes registrados.
              </p>
            </div>
          )}
        </div>

        {/* BOTÓN Y FORMULARIO PARA AGREGAR NUEVO CHOFER */}
        <div style={{ maxWidth: '480px', margin: '24px auto 0', borderTop: '1px solid #cbd5e1', paddingTop: 16 }}>
          {!showForm && (
            <button 
              className="btn btn-secondary" 
              onClick={() => setShowForm(true)} 
              style={{ width: '100%', marginBottom: 0 }}
            >
              + Agregar nuevo chofer
            </button>
          )}

          {showForm && (
            <div className="card" style={{ padding: 18 }}>
              <div className="card-title">Registrar nuevo Chofer</div>
              <div className="field">
                <label>Nombre completo *</label>
                <input 
                  value={nombre} 
                  onChange={(e) => setNombre(e.target.value)} 
                  placeholder="Ej: Juan Pérez" 
                />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={guardarChofer} disabled={guardando || !nombre.trim()}>
                  {guardando ? 'Guardando...' : 'Guardar y Registrar'}
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </>
  )
}