import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/SessionContext'
import { getUnidadDeChofer } from '../lib/cache'
import { TIPOS_VENCIMIENTO } from '../lib/constants'
import TopBar from '../components/TopBar'

// Misma lógica de cálculo que usa el admin, para que el estado se vea
// exactamente igual en ambas pantallas.
function calcularEstadoVencimiento(fechaVencimiento) {
  if (!fechaVencimiento) return { dias: null, label: 'Sin fecha cargada', color: '#94a3b8', nivel: 'sin_datos' }
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const vence = new Date(fechaVencimiento + 'T00:00:00')
  const dias = Math.ceil((vence - hoy) / (1000 * 60 * 60 * 24))

  if (dias < 0) return { dias, label: `Vencido hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? 's' : ''}`, color: '#dc2626', nivel: 'vencido' }
  if (dias === 0) return { dias, label: 'Vence hoy', color: '#dc2626', nivel: 'vencido' }
  if (dias <= 7) return { dias, label: `Vence en ${dias} día${dias !== 1 ? 's' : ''}`, color: '#d97706', nivel: 'proximo' }
  if (dias <= 30) return { dias, label: `Vence en ${dias} días`, color: '#d97706', nivel: 'proximo' }
  return { dias, label: `Vence en ${dias} días`, color: '#16a34a', nivel: 'ok' }
}

export default function VencimientosChofer() {
  const { session } = useSession()
  const [unidad, setUnidad] = useState(null)
  const [vencimientos, setVencimientos] = useState({})
  const [loading, setLoading] = useState(true)

  const [editando, setEditando] = useState(null) // tipo ('vtv' | 'senasa')
  const [fechaVencEdit, setFechaVencEdit] = useState('')
  const [fechaRenovEdit, setFechaRenovEdit] = useState('')
  const [notasEdit, setNotasEdit] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    const unidadData = await getUnidadDeChofer(session.id)
    setUnidad(unidadData)

    if (unidadData) {
      const { data } = await supabase
        .from('vencimientos')
        .select('*')
        .eq('unidad_id', unidadData.id)
        .eq('activo', true)
      const mapa = {}
      ;(data || []).forEach((v) => { mapa[v.tipo] = v })
      setVencimientos(mapa)
    }
    setLoading(false)
  }, [session.id])

  useEffect(() => {
    cargar()
  }, [cargar])

  function abrirEditor(tipo) {
    const actual = vencimientos[tipo] || null
    setEditando(tipo)
    setFechaVencEdit(actual?.fecha_vencimiento || '')
    setFechaRenovEdit(actual?.fecha_ultima_renovacion || '')
    setNotasEdit(actual?.notas || '')
  }

  async function guardarVencimiento() {
    if (!fechaVencEdit || !editando || !unidad) return
    setGuardando(true)

    const existing = vencimientos[editando]

    if (existing) {
      await supabase.from('vencimientos').update({
        fecha_vencimiento: fechaVencEdit,
        fecha_ultima_renovacion: fechaRenovEdit || null,
        notas: notasEdit.trim() || null,
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id)
    } else {
      await supabase.from('vencimientos').insert({
        unidad_id: unidad.id,
        tipo: editando,
        fecha_vencimiento: fechaVencEdit,
        fecha_ultima_renovacion: fechaRenovEdit || null,
        notas: notasEdit.trim() || null,
      })
    }

    setGuardando(false)
    setEditando(null)
    setAviso('Datos guardados correctamente.')
    setTimeout(() => setAviso(''), 3500)
    cargar()
  }

  if (loading) {
    return (
      <>
        <TopBar title="📋 VTV y SENASA" />
        <div className="loading-spinner">Cargando...</div>
      </>
    )
  }

  if (!unidad) {
    return (
      <>
        <TopBar title="📋 VTV y SENASA" />
        <div className="content">
          <div className="card">
            <div className="empty-state">
              <div className="icon">🚫</div>
              <p>Todavía no elegiste tu camión.<br />Hacelo desde la pantalla de Inicio.</p>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <TopBar title="📋 VTV y SENASA" subtitle={`Patente ${unidad.patente}`} />
      <div className="content">
        {aviso && (
          <div className="card" style={{ background: '#f0fdf4', borderColor: '#bbf7d0', fontSize: 13.5, color: '#16a34a', fontWeight: 600 }}>
            ✓ {aviso}
          </div>
        )}

        <div className="card" style={{ background: '#eef4fb', borderColor: '#cbdcef', fontSize: 13, color: '#00558c' }}>
          Cargá la fecha de vencimiento de cada documento. El administrador recibe un aviso automático cuando falten 7 días o menos.
        </div>

        <div className="card">
          {TIPOS_VENCIMIENTO.map((tipo) => {
            const v = vencimientos[tipo.key]
            const estado = calcularEstadoVencimiento(v?.fecha_vencimiento)
            return (
              <div
                key={tipo.key}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 0',
                  borderTop: tipo.key === TIPOS_VENCIMIENTO[0].key ? 'none' : '1px solid #f1f5f9',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 22 }}>{tipo.icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{tipo.label}</div>
                      {v?.fecha_vencimiento ? (
                        <div style={{ fontSize: 12.5, color: '#64748b' }}>
                          Vence: {new Date(v.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-AR')}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12.5, color: '#94a3b8' }}>Sin fecha cargada</div>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <span style={{
                    fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 100,
                    background: estado.color + '20', color: estado.color, whiteSpace: 'nowrap',
                  }}>
                    {estado.label}
                  </span>
                  <button
                    onClick={() => abrirEditor(tipo.key)}
                    className="btn btn-outline btn-sm"
                  >
                    {v ? 'Editar' : '+ Cargar'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {editando && (
        <div className="modal-overlay" onClick={() => setEditando(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {TIPOS_VENCIMIENTO.find((t) => t.key === editando)?.icon}{' '}
                {TIPOS_VENCIMIENTO.find((t) => t.key === editando)?.label}
              </h2>
              <button className="close-btn" onClick={() => setEditando(null)}>✕</button>
            </div>
            <div className="field">
              <label>Fecha de vencimiento *</label>
              <input
                type="date"
                value={fechaVencEdit}
                onChange={(e) => setFechaVencEdit(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Fecha de última renovación (opcional)</label>
              <input
                type="date"
                value={fechaRenovEdit}
                onChange={(e) => setFechaRenovEdit(e.target.value)}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Notas (opcional)</label>
              <input
                value={notasEdit}
                onChange={(e) => setNotasEdit(e.target.value)}
                placeholder="Ej: Trámite hecho en Posadas"
              />
            </div>
            <button
              className="btn btn-primary"
              style={{ marginTop: 16 }}
              onClick={guardarVencimiento}
              disabled={guardando || !fechaVencEdit}
            >
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
