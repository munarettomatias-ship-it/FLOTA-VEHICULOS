import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { TIPOS_VENCIMIENTO } from '../lib/constants'
import TopBar from '../components/TopBar'

// Calcula cuántos días faltan para el vencimiento y devuelve el estado visual.
function calcularEstadoVencimiento(fechaVencimiento) {
  if (!fechaVencimiento) return { dias: null, label: 'Sin fecha', color: '#94a3b8', nivel: 'sin_datos' }
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

export default function VencimientosAdmin() {
  const [unidades, setUnidades] = useState([])
  const [vencimientos, setVencimientos] = useState([])
  const [loading, setLoading] = useState(true)

  // Modal de edición
  const [editando, setEditando] = useState(null)
  // { unidad, tipo ('vtv'|'senasa'), vencimientoActual (o null) }
  const [fechaVencEdit, setFechaVencEdit] = useState('')
  const [fechaRenovEdit, setFechaRenovEdit] = useState('')
  const [notasEdit, setNotasEdit] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Filtro de estado
  const [filtro, setFiltro] = useState('todos')

  const cargar = useCallback(async () => {
    setLoading(true)
    const [{ data: unidadesData }, { data: vencimientosData }] = await Promise.all([
      supabase.from('unidades').select('id, patente, marca, modelo').eq('activo', true).order('patente'),
      supabase.from('vencimientos').select('*').eq('activo', true),
    ])
    setUnidades(unidadesData || [])
    setVencimientos(vencimientosData || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  // Construye un mapa unidad → { vtv, senasa } para acceso rápido
  const mapaVencimientos = {}
  vencimientos.forEach((v) => {
    if (!mapaVencimientos[v.unidad_id]) mapaVencimientos[v.unidad_id] = {}
    mapaVencimientos[v.unidad_id][v.tipo] = v
  })

  function abrirEditor(unidad, tipo) {
    const actual = mapaVencimientos[unidad.id]?.[tipo] || null
    setEditando({ unidad, tipo })
    setFechaVencEdit(actual?.fecha_vencimiento || '')
    setFechaRenovEdit(actual?.fecha_ultima_renovacion || '')
    setNotasEdit(actual?.notas || '')
  }

  async function guardarVencimiento() {
    if (!fechaVencEdit || !editando) return
    setGuardando(true)

    const existing = mapaVencimientos[editando.unidad.id]?.[editando.tipo]

    if (existing) {
      await supabase.from('vencimientos').update({
        fecha_vencimiento: fechaVencEdit,
        fecha_ultima_renovacion: fechaRenovEdit || null,
        notas: notasEdit.trim() || null,
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id)
    } else {
      await supabase.from('vencimientos').insert({
        unidad_id: editando.unidad.id,
        tipo: editando.tipo,
        fecha_vencimiento: fechaVencEdit,
        fecha_ultima_renovacion: fechaRenovEdit || null,
        notas: notasEdit.trim() || null,
      })
    }

    setGuardando(false)
    setEditando(null)
    cargar()
  }

  // Resumen: cuántas unidades tienen algo vencido o próximo
  const totalVencidos = unidades.filter((u) =>
    TIPOS_VENCIMIENTO.some((t) => {
      const v = mapaVencimientos[u.id]?.[t.key]
      return calcularEstadoVencimiento(v?.fecha_vencimiento).nivel === 'vencido'
    })
  ).length

  const totalProximos = unidades.filter((u) =>
    TIPOS_VENCIMIENTO.some((t) => {
      const v = mapaVencimientos[u.id]?.[t.key]
      return calcularEstadoVencimiento(v?.fecha_vencimiento).nivel === 'proximo'
    })
  ).length

  const unidadesFiltradas = unidades.filter((u) => {
    if (filtro === 'todos') return true
    return TIPOS_VENCIMIENTO.some((t) => {
      const v = mapaVencimientos[u.id]?.[t.key]
      const estado = calcularEstadoVencimiento(v?.fecha_vencimiento)
      if (filtro === 'vencidos') return estado.nivel === 'vencido'
      if (filtro === 'proximos') return estado.nivel === 'proximo' || estado.nivel === 'vencido'
      if (filtro === 'sin_datos') return estado.nivel === 'sin_datos'
      return true
    })
  })

  return (
    <>
      <TopBar title="📋 VTV y SENASA" subtitle="Vencimientos por unidad" />
      <div className="content">

        {/* Resumen de estado */}
        {!loading && (totalVencidos > 0 || totalProximos > 0) && (
          <div className="card" style={{
            background: totalVencidos > 0 ? '#fef2f2' : '#fff7ed',
            borderColor: totalVencidos > 0 ? '#fecaca' : '#fed7aa',
            marginBottom: 14,
          }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <span style={{ fontSize: 26 }}>{totalVencidos > 0 ? '🚨' : '⚠️'}</span>
              <div>
                {totalVencidos > 0 && (
                  <div style={{ fontWeight: 700, color: '#dc2626', fontSize: 14 }}>
                    {totalVencidos} unidad{totalVencidos !== 1 ? 'es' : ''} con VTV/SENASA vencido
                  </div>
                )}
                {totalProximos > 0 && (
                  <div style={{ fontWeight: 600, color: '#d97706', fontSize: 13, marginTop: totalVencidos > 0 ? 2 : 0 }}>
                    {totalProximos} unidad{totalProximos !== 1 ? 'es' : ''} próximas a vencer (≤ 7 días)
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Filtro rápido */}
        <div className="tabs" style={{ marginBottom: 14 }}>
          {[
            { key: 'todos', label: 'Todas' },
            { key: 'vencidos', label: '🔴 Vencidos' },
            { key: 'proximos', label: '🟡 Próximos' },
            { key: 'sin_datos', label: '⚪ Sin cargar' },
          ].map((f) => (
            <button
              key={f.key}
              className={`tab-btn ${filtro === f.key ? 'active' : ''}`}
              onClick={() => setFiltro(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading && <div className="loading-spinner">Cargando...</div>}

        {!loading && unidadesFiltradas.length === 0 && (
          <div className="card">
            <div className="empty-state" style={{ padding: 24 }}>
              <div className="icon">✅</div>
              <p>No hay unidades en esta categoría.</p>
            </div>
          </div>
        )}

        {/* Tarjeta por unidad con estado de VTV y SENASA */}
        {!loading && unidadesFiltradas.map((u) => (
          <div key={u.id} className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#003d66', marginBottom: 10 }}>
              🚚 {u.patente}
              {(u.marca || u.modelo) && (
                <span style={{ fontWeight: 400, fontSize: 12.5, color: '#64748b', marginLeft: 8 }}>
                  {u.marca} {u.modelo}
                </span>
              )}
            </div>

            {TIPOS_VENCIMIENTO.map((tipo) => {
              const v = mapaVencimientos[u.id]?.[tipo.key]
              const estado = calcularEstadoVencimiento(v?.fecha_vencimiento)
              return (
                <div
                  key={tipo.key}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 0',
                    borderTop: '1px solid #f1f5f9',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{tipo.icon}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{tipo.label}</div>
                        {v?.fecha_vencimiento ? (
                          <div style={{ fontSize: 12, color: '#64748b' }}>
                            Vence: {new Date(v.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-AR')}
                            {v.fecha_ultima_renovacion && ` · Renovó: ${new Date(v.fecha_ultima_renovacion + 'T00:00:00').toLocaleDateString('es-AR')}`}
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: '#94a3b8' }}>Sin fecha cargada</div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 100,
                      background: estado.color + '20', color: estado.color,
                    }}>
                      {estado.label}
                    </span>
                    <button
                      onClick={() => abrirEditor(u, tipo.key)}
                      style={{
                        background: '#f1f5f9', border: 'none', borderRadius: 8,
                        padding: '6px 10px', fontSize: 12, fontWeight: 600, color: '#475569',
                      }}
                    >
                      {v ? 'Editar' : '+ Cargar'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Modal de edición de fecha de vencimiento */}
      {editando && (
        <div className="modal-overlay" onClick={() => setEditando(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {TIPOS_VENCIMIENTO.find((t) => t.key === editando.tipo)?.icon}{' '}
                {TIPOS_VENCIMIENTO.find((t) => t.key === editando.tipo)?.label}
              </h2>
              <button className="close-btn" onClick={() => setEditando(null)}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: '#475569', marginBottom: 16, fontWeight: 600 }}>
              🚚 {editando.unidad.patente}
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
                placeholder="Ej: Turno pedido para el 20/07"
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
