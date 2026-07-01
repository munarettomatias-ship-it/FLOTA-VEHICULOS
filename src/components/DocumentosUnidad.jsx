import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const TIPOS_DOC = [
  { key: 'presupuesto', label: 'Presupuesto', icon: '📄' },
  { key: 'diagnostico', label: 'Diagnóstico', icon: '🔍' },
  { key: 'otro', label: 'Otro', icon: '📎' },
]

export default function DocumentosUnidad({ unidadId }) {
  const [documentos, setDocumentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [archivo, setArchivo] = useState(null)
  const [preview, setPreview] = useState(null)
  const [tipo, setTipo] = useState('presupuesto')
  const [titulo, setTitulo] = useState('')
  const [notas, setNotas] = useState('')
  const [verImagen, setVerImagen] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    cargar()
  }, [unidadId])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase
      .from('documentos_unidad')
      .select('*')
      .eq('unidad_id', unidadId)
      .order('created_at', { ascending: false })
    setDocumentos(data || [])
    setLoading(false)
  }

  function handleArchivo(e) {
    const file = e.target.files[0]
    if (!file) return
    setArchivo(file)
    if (file.type.startsWith('image/')) {
      setPreview(URL.createObjectURL(file))
    } else {
      setPreview(null)
    }
    if (!titulo) setTitulo(file.name.replace(/\.[^/.]+$/, ''))
  }

  async function subirDocumento() {
    if (!archivo || !titulo.trim()) return
    setSubiendo(true)

    const ext = archivo.name.split('.').pop()
    const path = `${unidadId}/${tipo}_${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('flota-documentos')
      .upload(path, archivo)

    if (uploadError) {
      setSubiendo(false)
      alert('Error al subir el archivo: ' + uploadError.message)
      return
    }

    const { data: urlData } = supabase.storage.from('flota-documentos').getPublicUrl(path)

    await supabase.from('documentos_unidad').insert({
      unidad_id: unidadId,
      tipo,
      titulo: titulo.trim(),
      url: urlData.publicUrl,
      notas: notas.trim() || null,
    })

    setSubiendo(false)
    setShowForm(false)
    setArchivo(null); setPreview(null); setTitulo(''); setNotas(''); setTipo('presupuesto')
    if (fileInputRef.current) fileInputRef.current.value = ''
    cargar()
  }

  async function eliminarDocumento(doc) {
    if (!confirm(`¿Eliminar "${doc.titulo}"?`)) return
    await supabase.from('documentos_unidad').delete().eq('id', doc.id)
    cargar()
  }

  return (
    <>
      {!showForm && (
        <button className="btn btn-secondary" onClick={() => setShowForm(true)} style={{ marginBottom: 14 }}>
          📎 Subir presupuesto / diagnóstico
        </button>
      )}

      {showForm && (
        <div className="card">
          <div className="card-title">Nuevo documento</div>

          <div className="field">
            <label>Tipo</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {TIPOS_DOC.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTipo(t.key)}
                  style={{
                    flex: 1, padding: '10px 8px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                    border: '1.5px solid', borderColor: tipo === t.key ? '#006cb5' : '#e2e8f0',
                    background: tipo === t.key ? '#eef4fb' : 'white',
                    color: tipo === t.key ? '#003d66' : '#475569',
                  }}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Foto o archivo *</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              onChange={handleArchivo}
            />
            {preview && <img src={preview} className="photo-preview" alt="preview" />}
            {archivo && !preview && (
              <div style={{ fontSize: 13, color: '#475569', marginTop: 8 }}>
                📎 {archivo.name}
              </div>
            )}
          </div>

          <div className="field">
            <label>Título *</label>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej: Presupuesto pastillas de freno" />
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label>Notas (opcional)</label>
            <textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej: Taller Don José, válido por 15 días" />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn btn-outline" onClick={() => { setShowForm(false); setArchivo(null); setPreview(null) }}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={subirDocumento}
              disabled={subiendo || !archivo || !titulo.trim()}
            >
              {subiendo ? 'Subiendo...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {loading && <div className="loading-spinner">Cargando...</div>}

      {!loading && documentos.length === 0 && !showForm && (
        <div className="card">
          <div className="empty-state" style={{ padding: 24 }}>
            <div className="icon">📎</div>
            <p>Sin presupuestos ni diagnósticos cargados todavía.</p>
          </div>
        </div>
      )}

      {!loading && documentos.length > 0 && (
        <div className="card">
          {documentos.map((doc) => {
            const tipoInfo = TIPOS_DOC.find((t) => t.key === doc.tipo)
            const esImagen = /\.(jpe?g|png|webp|gif)$/i.test(doc.url)
            return (
              <div key={doc.id} className="history-item">
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  {esImagen ? (
                    <img
                      src={doc.url}
                      alt={doc.titulo}
                      onClick={() => setVerImagen(doc.url)}
                      style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', flexShrink: 0, cursor: 'pointer' }}
                    />
                  ) : (
                    <div style={{ width: 56, height: 56, borderRadius: 10, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                      📄
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="history-top">
                      <span>{tipoInfo?.icon} {doc.titulo}</span>
                    </div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: '#006cb5', marginTop: 2 }}>
                      {tipoInfo?.label}
                    </div>
                    {doc.notas && <div className="history-desc">{doc.notas}</div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, alignItems: 'center' }}>
                      <span className="history-date">{new Date(doc.created_at).toLocaleDateString('es-AR')}</span>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, fontWeight: 600, color: '#006cb5' }}>
                          Ver
                        </a>
                        <button onClick={() => eliminarDocumento(doc)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 12.5, fontWeight: 600, padding: 0 }}>
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {verImagen && (
        <div className="modal-overlay" onClick={() => setVerImagen(null)}>
          <div style={{ maxWidth: '90vw', maxHeight: '85vh' }} onClick={(e) => e.stopPropagation()}>
            <img src={verImagen} alt="documento" style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 12 }} />
          </div>
        </div>
      )}
    </>
  )
}
