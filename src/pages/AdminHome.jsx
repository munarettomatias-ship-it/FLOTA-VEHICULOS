import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/SessionContext'
import { TIPOS_VENCIMIENTO } from '../lib/constants'
import TopBar from '../components/TopBar'

function diasParaVencer(fecha) {
  if (!fecha) return null
  const hoy = new Date(); hoy.setHours(0,0,0,0)
  return Math.ceil((new Date(fecha + 'T00:00:00') - hoy) / (1000 * 60 * 60 * 24))
}

export default function AdminHome() {
  const { session } = useSession()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ unidades: 0, fallasPendientes: 0, fallasCriticas: 0, checklistsHoy: 0 })
  const [unidadesAlerta, setUnidadesAlerta] = useState([])
  const [vencimientosCriticos, setVencimientosCriticos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    setLoading(true)

    const hoyInicio = new Date()
    hoyInicio.setHours(0, 0, 0, 0)

    const [
      { count: totalUnidades },
      { count: fallasPendientes },
      { count: fallasCriticas },
      { count: checklistsHoy },
      { data: unidadesData },
      { data: vencimientosData },
    ] = await Promise.all([
      supabase.from('unidades').select('*', { count: 'exact', head: true }).eq('activo', true),
      supabase.from('reportes_fallas').select('*', { count: 'exact', head: true }).neq('estado', 'resuelto'),
      supabase.from('reportes_fallas').select('*', { count: 'exact', head: true }).eq('gravedad', 'critica').neq('estado', 'resuelto'),
      supabase.from('checklists').select('*', { count: 'exact', head: true }).gte('fecha', hoyInicio.toISOString()),
      supabase.from('unidades').select('*, choferes(nombre)').neq('estado', 'verde').eq('activo', true).order('estado'),
      supabase.from('vencimientos').select('*, unidades(patente)').eq('activo', true),
    ])

    // Filtramos vencimientos próximos (≤ 7 días) o ya vencidos
    const criticos = (vencimientosData || []).filter((v) => {
      const dias = diasParaVencer(v.fecha_vencimiento)
      return dias !== null && dias <= 7
    }).sort((a, b) => new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento))

    setStats({
      unidades: totalUnidades || 0,
      fallasPendientes: fallasPendientes || 0,
      fallasCriticas: fallasCriticas || 0,
      checklistsHoy: checklistsHoy || 0,
    })
    setUnidadesAlerta(unidadesData || [])
    setVencimientosCriticos(criticos)
    setLoading(false)
  }

  return (
    <>
      <TopBar title="Panel Admin" subtitle={`Hola, ${session?.nombre}`} />
      <div className="content">
        {loading && <div className="loading-spinner">Cargando...</div>}

        {!loading && (
          <>
            {/* Banner de vencimientos críticos */}
            {vencimientosCriticos.length > 0 && (
              <div
                className="card"
                style={{ background: '#fef2f2', borderColor: '#fecaca', marginBottom: 14, cursor: 'pointer' }}
                onClick={() => navigate('/vencimientos')}
              >
                <div style={{ fontWeight: 700, color: '#dc2626', fontSize: 14, marginBottom: 8 }}>
                  🚨 Vencimientos urgentes ({vencimientosCriticos.length})
                </div>
                {vencimientosCriticos.map((v) => {
                  const dias = diasParaVencer(v.fecha_vencimiento)
                  const tipo = TIPOS_VENCIMIENTO.find((t) => t.key === v.tipo)
                  const vencido = dias < 0
                  return (
                    <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span>{tipo?.icon} {v.unidades?.patente} — {tipo?.label}</span>
                      <span style={{ fontWeight: 700, color: vencido ? '#dc2626' : '#d97706' }}>
                        {vencido
                          ? `Vencido hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? 's' : ''}`
                          : dias === 0 ? 'Vence hoy' : `${dias} día${dias !== 1 ? 's' : ''}`
                        }
                      </span>
                    </div>
                  )
                })}
                <div style={{ fontSize: 12, color: '#dc2626', marginTop: 6, opacity: 0.75 }}>
                  Tocá para ver todos los vencimientos →
                </div>
              </div>
            )}

            <div className="stat-grid">
              <div className="stat-box">
                <div className="stat-icon">🚚</div>
                <div className="num">{stats.unidades}</div>
                <div className="lbl">Unidades activas</div>
              </div>
              <div className="stat-box" style={{ cursor: 'pointer' }} onClick={() => navigate('/checklists')}>
                <div className="stat-icon">✅</div>
                <div className="num" style={{ color: stats.checklistsHoy >= stats.unidades ? 'var(--verde)' : 'var(--amarillo)' }}>
                  {stats.checklistsHoy}/{stats.unidades}
                </div>
                <div className="lbl">Checklists de hoy ›</div>
              </div>
              <div className="stat-box">
                <div className="stat-icon">⚠️</div>
                <div className="num" style={{ color: stats.fallasPendientes > 0 ? 'var(--amarillo)' : 'var(--verde)' }}>
                  {stats.fallasPendientes}
                </div>
                <div className="lbl">Fallas pendientes</div>
              </div>
              <div className="stat-box">
                <div className="stat-icon">🔴</div>
                <div className="num" style={{ color: stats.fallasCriticas > 0 ? 'var(--rojo)' : 'var(--verde)' }}>
                  {stats.fallasCriticas}
                </div>
                <div className="lbl">Fallas críticas</div>
              </div>
            </div>

            <div className="section-label" style={{ marginTop: 6 }}>Unidades que requieren atención</div>
            {unidadesAlerta.length === 0 && (
              <div className="card" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                <div className="empty-state" style={{ padding: 24 }}>
                  <div className="icon">✅</div>
                  <p style={{ color: '#16a34a', fontWeight: 600 }}>Toda la flota está en buen estado</p>
                </div>
              </div>
            )}
            {unidadesAlerta.map((u) => (
              <div key={u.id} className="unidad-card" style={{ cursor: 'pointer' }} onClick={() => navigate(`/unidades/${u.id}`)}>
                <span className="estado-dot" style={{
                  background: u.estado === 'amarillo' ? 'var(--amarillo)' : 'var(--rojo)'
                }} />
                <div className="unidad-info">
                  <div className="unidad-patente">{u.patente}</div>
                  <div className="unidad-sub">{u.marca} {u.modelo} · {u.choferes?.nombre || 'Sin chofer'}</div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </>
  )
}
