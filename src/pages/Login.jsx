import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Login() {
  const navigate = useNavigate()
  const [perfil, setPerfil] = useState('chofer') // 'chofer' o 'admin'
  const [choferes, setChoferes] = useState([])
  const [loading, setLoading] = useState(true)
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

  async function seleccionarChofer(chofer) {
    localStorage.setItem('chofer_flota', JSON.stringify(chofer))
    navigate('/chofer/mis-unidades')
  }

  async function guardarChofer() {
    if (!nombre.trim()) return
    setGuardando(true)
    const { error } = await supabase
      .from('choferes')
      .insert({ nombre: nombre.trim() })
    
    if (!error) {
      setNombre('')
      setShowForm(false)
      cargarChoferes()
    }
    setGuardando(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundImage: 'linear-gradient(rgba(15, 23, 42, 0.65), rgba(15, 23, 42, 0.85)), url("https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=1200")',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      padding: '20px',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.90)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius: '24px',
        padding: '36px 32px',
        width: '100%',
        maxWidth: '430px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        textAlign: 'center'
      }}>
        {/* LOGO E ICONO */}
        <div style={{ fontSize: '54px', marginBottom: '12px' }}>🚛</div>
        <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a', marginBottom: '6px', letterSpacing: '-0.5px' }}>
          Control de Flota
        </h1>
        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '32px' }}>
          Seleccioná tu perfil para continuar
        </p>

        {/* SELECTOR DE PERFIL (TABS PREMIUM) */}
        <div style={{ 
          display: 'flex', 
          background: 'rgba(148, 163, 184, 0.12)', 
          padding: '4px', 
          borderRadius: '14px', 
          marginBottom: '28px'
        }}>
          <button 
            onClick={() => setPerfil('chofer')}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '11px',
              border: 'none',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              backgroundColor: perfil === 'chofer' ? '#ffedd5' : 'transparent',
              color: perfil === 'chofer' ? '#ea580c' : '#475569',
              boxShadow: perfil === 'chofer' ? '0 4px 12px rgba(234, 88, 12, 0.15)' : 'none'
            }}
          >
            👮 Chofer
          </button>
          <button 
            onClick={() => setPerfil('admin')}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '11px',
              border: 'none',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              backgroundColor: perfil === 'admin' ? '#f1f5f9' : 'transparent',
              color: perfil === 'admin' ? '#1e293b' : '#475569',
              boxShadow: perfil === 'admin' ? '0 4px 12px rgba(0, 0, 0, 0.05)' : 'none'
            }}
          >
            🛠️ Administrador
          </button>
        </div>

        {/* VISTA DINÁMICA: CHOFER */}
        {perfil === 'chofer' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {loading ? (
              <p style={{ color: '#94a3b8', fontSize: '14px', padding: '10px' }}>Cargando choferes...</p>
            ) : (
              choferes.map((c) => (
                <div 
                  key={c.id}
                  onClick={() => seleccionarChofer(c)}
                  style={{
                    padding: '16px 20px',
                    background: '#ffffff',
                    borderRadius: '14px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#ea580c';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.01)';
                  }}
                >
                  <span style={{ fontWeight: '600', color: '#1e293b', fontSize: '15px' }}>{c.nombre}</span>
                  <span style={{ color: '#94a3b8', fontWeight: 'bold' }}>➔</span>
                </div>
              ))
            )}

            {!showForm ? (
              <button 
                onClick={() => setShowForm(true)}
                style={{
                  marginTop: '6px',
                  padding: '14px',
                  background: 'transparent',
                  border: '2px dashed #cbd5e1',
                  borderRadius: '14px',
                  color: '#64748b',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                + Agregar nuevo chofer
              </button>
            ) : (
              <div style={{ 
                background: '#f8fafc', 
                padding: '16px', 
                borderRadius: '14px', 
                border: '1px solid #e2e8f0',
                textAlign: 'left',
                marginTop: '6px'
              }}>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '6px' }}>
                  Nombre completo
                </label>
                <input 
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Carlos Tévez"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    marginBottom: '14px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => setShowForm(false)}
                    style={{ flex: 1, padding: '10px', background: '#e2e8f0', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', color: '#475569', fontSize: '13px' }}
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={guardarChofer}
                    disabled={guardando || !nombre.trim()}
                    style={{ flex: 1, padding: '10px', background: '#ea580c', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
                  >
                    {guardando ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VISTA DINÁMICA: ADMINISTRADOR */}
        {perfil === 'admin' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <button 
              onClick={() => navigate('/admin/unidades')}
              style={{
                width: '100%',
                padding: '15px',
                background: '#0f172a',
                color: '#fff',
                border: 'none',
                borderRadius: '14px',
                fontWeight: '600',
                fontSize: '15px',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
            >
              Ingresar al Panel de Control ➔
            </button>
          </div>
        )}

      </div>
    </div>
  )
}