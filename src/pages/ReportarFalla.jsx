import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/SessionContext'
import { CATEGORIAS_FALLA, GRAVEDAD_OPCIONES } from '../lib/constants'
import { getUnidadDeChofer } from '../lib/cache'
import { adjuntarFotoEnBackground, actualizarEstadoUnidadEnBackground } from '../lib/unidadOps'
import TopBar from '../components/TopBar'

export default function ReportarFalla() {
  const { session } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const fileInputRef = useRef(null)

  const [unidad, setUnidad] = useState(null)
  const [categoria, setCategoria] = useState('mecanica')
  const [gravedad, setGravedad] = useState('media')
  const [descripcion, setDescripcion] = useState('')
  const [foto, setFoto] = useState(null)
  const [fotoPreview, setFotoPreview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState(false)

  useEffect(() => {
    cargarUnidad()
  }, [])

  async function cargarUnidad() {
    const data = await getUnidadDeChofer(session.id)
    setUnidad(data)
    setLoading(false)
  }

  function handleFotoChange(e) {
    const file = e.target.files[0]
    if (file) {
      setFoto(file)
      setFotoPreview(URL.createObjectURL(file))
    }
  }

  async function guardarReporte() {
    if (!unidad || !descripcion.trim()) return
    setGuardando(true)

    // Insertamos el reporte sin la foto: el texto es lo crítico y debe
    // llegar rápido aunque la señal sea mala. La foto pesa más y puede
    // demorar, así que se sube después en segundo plano.
    const { data: nuevoReporte, error } = await supabase
      .from('reportes_fallas')
      .insert({
        unidad_id: unidad.id,
        chofer_id: session.id,
        categoria,
        descripcion: descripcion.trim(),
        gravedad,
        foto_url: null,
      })
      .select()
      .single()

    setGuardando(false)
    if (error) return

    // Tareas de fondo: no se esperan, no bloquean la navegación del chofer.
    if (foto) {
      adjuntarFotoEnBackground(nuevoReporte.id, foto, unidad.id)
    }
    actualizarEstadoUnidadEnBackground(unidad.id)

    setExito(true)
    setTimeout(() => navigate('/'), 1600)
  }

  if (loading) {
    return (
      <>
        <TopBar title="⚠️ Reportar falla" />
        <div className="loading-spinner">Cargando...</div>
      </>
    )
  }

  if (!unidad) {
    return (
      <>
        <TopBar title="⚠️ Reportar falla" />
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

  if (exito) {
    return (
      <>
        <TopBar title="⚠️ Reportar falla" />
        <div className="content">
          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 10 }}>✅</div>
            <div style={{ fontWeight: 700, color: '#16a34a', fontSize: 16 }}>
              Reporte enviado correctamente
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
              El administrador ya fue notificado
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <TopBar title="⚠️ Reportar falla" subtitle={`Patente ${unidad.patente}`} />
      <div className="content">
        {location.state?.desdeChecklist && (
          <div className="card" style={{ background: '#fff7ed', borderColor: '#fed7aa' }}>
            <span style={{ fontSize: 13, color: '#d97706', fontWeight: 600 }}>
              Marcaste fallas en el checklist. Contanos los detalles para que el administrador pueda actuar.
            </span>
          </div>
        )}

        <div className="card">
          <div className="card-title">Categoría</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIAS_FALLA.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setCategoria(cat.key)}
                className="toggle-btn"
                style={{
                  background: categoria === cat.key ? '#1d4e89' : 'white',
                  borderColor: categoria === cat.key ? '#1d4e89' : '#e2e8f0',
                  color: categoria === cat.key ? 'white' : '#475569',
                }}
              >
                {cat.icon} {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title">Gravedad</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {GRAVEDAD_OPCIONES.map((g) => (
              <button
                key={g.key}
                onClick={() => setGravedad(g.key)}
                className="toggle-btn"
                style={{
                  flex: 1,
                  background: gravedad === g.key ? g.color : 'white',
                  borderColor: gravedad === g.key ? g.color : '#e2e8f0',
                  color: gravedad === g.key ? 'white' : '#475569',
                }}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="field" style={{ marginBottom: foto ? 10 : 0 }}>
            <label>Descripción del problema *</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Describí qué está pasando, desde cuándo, qué ruido/síntoma notás..."
            />
          </div>

          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={fileInputRef}
            onChange={handleFotoChange}
            style={{ display: 'none' }}
          />
          <button className="btn btn-outline" onClick={() => fileInputRef.current.click()}>
            📷 {foto ? 'Cambiar foto' : 'Agregar foto (opcional)'}
          </button>
          {fotoPreview && <img src={fotoPreview} className="photo-preview" alt="preview" />}
        </div>

        <button
          className="btn btn-primary"
          onClick={guardarReporte}
          disabled={guardando || !descripcion.trim()}
        >
          {guardando ? 'Enviando...' : 'Enviar reporte'}
        </button>
      </div>
    </>
  )
}
