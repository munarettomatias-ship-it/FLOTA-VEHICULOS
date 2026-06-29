import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/SessionContext'
import { getChoferes } from '../lib/cache'

const ADMINS = [
  { id: 'admin-1', nombre: 'Administrador 1', pin: import.meta.env.VITE_ADMIN1_PIN || '1111' },
  { id: 'admin-2', nombre: 'Administrador 2', pin: import.meta.env.VITE_ADMIN2_PIN || '2222' },
]

const MAX_INTENTOS = 5
const BLOQUEO_MINUTOS = 5

export default function Login() {
  const { login } = useSession()
  const [role, setRole] = useState('chofer')
  const [choferes, setChoferes] = useState([])
  const [loading, setLoading] = useState(true)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [showNuevo, setShowNuevo] = useState(false)

  // flujo de PIN para admin
  const [adminSeleccionado, setAdminSeleccionado] = useState(null)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')
  const [bloqueadoHasta, setBloqueadoHasta] = useState(null)

  useEffect(() => {
    cargarChoferes()
  }, [])

  async function cargarChoferes() {
    setLoading(true)
    const data = await getChoferes()
    setChoferes(data)
    setLoading(false)
  }

  async function crearChofer() {
    if (!nuevoNombre.trim()) return
    const { data, error } = await supabase
      .from('choferes')
      .insert({ nombre: nuevoNombre.trim() })
      .select()
      .single()
    if (!error && data) {
      setChoferes([...choferes, data].sort((a, b) => a.nombre.localeCompare(b.nombre)))
      setNuevoNombre('')
      setShowNuevo(false)
      login({ role: 'chofer', id: data.id, nombre: data.nombre })
    }
  }

  function seleccionarAdmin(admin) {
    const bloqueoKey = `admin_bloqueo_${admin.id}`
    const bloqueoData = JSON.parse(localStorage.getItem(bloqueoKey) || 'null')
    if (bloqueoData && bloqueoData.hasta > Date.now()) {
      setBloqueadoHasta(bloqueoData.hasta)
    } else {
      setBloqueadoHasta(null)
    }
    setAdminSeleccionado(admin)
    setPinInput('')
    setPinError('')
  }

  function intentarPin(valor) {
    if (!adminSeleccionado) return
    const nuevoPin = valor
    setPinInput(nuevoPin)
    if (nuevoPin.length < 4) return

    const ahora = Date.now()
    const bloqueoKey = `admin_bloqueo_${adminSeleccionado.id}`
    const bloqueoData = JSON.parse(localStorage.getItem(bloqueoKey) || 'null')

    if (bloqueoData && bloqueoData.hasta > ahora) {
      setBloqueadoHasta(bloqueoData.hasta)
      return
    }

    if (nuevoPin === adminSeleccionado.pin) {
      localStorage.removeItem(bloqueoKey)
      login({ role: 'admin', id: adminSeleccionado.id, nombre: adminSeleccionado.nombre })
      return
    }

    const intentos = (bloqueoData?.intentos || 0) + 1
    if (intentos >= MAX_INTENTOS) {
      const hasta = ahora + BLOQUEO_MINUTOS * 60 * 1000
      localStorage.setItem(bloqueoKey, JSON.stringify({ intentos: 0, hasta }))
      setBloqueadoHasta(hasta)
      setPinError(`Demasiados intentos. Esperá ${BLOQUEO_MINUTOS} minutos.`)
    } else {
      localStorage.setItem(bloqueoKey, JSON.stringify({ intentos, hasta: 0 }))
      setPinError(`PIN incorrecto (quedan ${MAX_INTENTOS - intentos} intentos)`)
    }
    setPinInput('')
  }

  function volverASeleccionAdmin() {
    setAdminSeleccionado(null)
    setPinInput('')
    setPinError('')
    setBloqueadoHasta(null)
  }

  const minutosRestantes = bloqueadoHasta
    ? Math.ceil((bloqueadoHasta - Date.now()) / 60000)
    : 0

  return (
    <div className="login-screen">
      <img src="/icons/logo-mimen.jpg" alt="Mimen" className="login-logo-img" />
      <h1>Control de Flota</h1>
      <p>Seleccioná tu perfil para continuar</p>

      <div className="login-card">
        {!adminSeleccionado && (
          <div className="role-switch">
            <button className={role === 'chofer' ? 'active' : ''} onClick={() => setRole('chofer')}>
              👨‍✈️ Chofer
            </button>
            <button className={role === 'admin' ? 'active' : ''} onClick={() => setRole('admin')}>
              🛠️ Administrador
            </button>
          </div>
        )}

        {role === 'chofer' && !adminSeleccionado && (
          <>
            {loading && <p style={{ textAlign: 'center', opacity: 0.7 }}>Cargando...</p>}
            {!loading && choferes.map((c) => (
              <button
                key={c.id}
                className="driver-pill"
                onClick={() => login({ role: 'chofer', id: c.id, nombre: c.nombre })}
              >
                {c.nombre}
              </button>
            ))}

            {!showNuevo ? (
              <button
                className="driver-pill"
                style={{ borderStyle: 'dashed', textAlign: 'center', opacity: 0.85 }}
                onClick={() => setShowNuevo(true)}
              >
                + Agregar nuevo chofer
              </button>
            ) : (
              <div style={{ marginTop: 8 }}>
                <input
                  placeholder="Nombre y apellido"
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  style={{
                    width: '100%', padding: 12, borderRadius: 10, border: 'none',
                    marginBottom: 8, fontSize: 15,
                  }}
                  autoFocus
                />
                <button className="btn btn-primary" onClick={crearChofer}>Crear y continuar</button>
              </div>
            )}
          </>
        )}

        {role === 'admin' && !adminSeleccionado && (
          <>
            {ADMINS.map((a) => (
              <button
                key={a.id}
                className="driver-pill"
                onClick={() => seleccionarAdmin(a)}
              >
                🔒 {a.nombre}
              </button>
            ))}
          </>
        )}

        {adminSeleccionado && (
          <div>
            <button
              onClick={volverASeleccionAdmin}
              style={{ background: 'none', border: 'none', color: 'white', opacity: 0.7, fontSize: 13, marginBottom: 14, padding: 0 }}
            >
              ← Volver
            </button>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 30, marginBottom: 6 }}>🔒</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{adminSeleccionado.nombre}</div>
              <div style={{ fontSize: 12.5, opacity: 0.75 }}>Ingresá tu PIN de 4 dígitos</div>
            </div>

            {bloqueadoHasta && bloqueadoHasta > Date.now() ? (
              <div style={{
                background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.4)',
                borderRadius: 10, padding: 12, textAlign: 'center', fontSize: 13,
              }}>
                Cuenta bloqueada temporalmente.<br />Probá en {minutosRestantes} minuto(s).
              </div>
            ) : (
              <>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pinInput}
                  onChange={(e) => intentarPin(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                  style={{
                    width: '100%', padding: 14, borderRadius: 10, border: 'none',
                    marginBottom: 10, fontSize: 22, textAlign: 'center', letterSpacing: 8,
                  }}
                  placeholder="••••"
                />
                {pinError && (
                  <div style={{ color: '#fca5a5', fontSize: 12.5, textAlign: 'center', marginTop: 4 }}>
                    {pinError}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
