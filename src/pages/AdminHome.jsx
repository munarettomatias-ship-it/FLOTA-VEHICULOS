import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import TopBar from '../components/TopBar'

export default function AdminHome() {
  const [stats, setStats] = useState({ unidades: 0, fallasPendientes: 0, fallasCriticas: 0, checklistsHoy: 0 })
  const [unidadesAlerta, setUnidadesAlerta] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    setLoading(true)

    const hoyInicio = new Date()
    hoyInicio.setHours(0, 0, 0, 0)

    // Las 4 consultas son independientes entre sí (no comparten datos),
    // así que se disparan todas a la vez en vez de una tras otra.
    const [
      { count: totalUnidades },
      { count: fallasPendientes },
      { count: fallasCriticas },
      { count: checklistsHoy },
      { data: unidadesData },
    ] = await Promise.all([
      supabase.from('unidades').select('*', { count: 'exact', head: true }).eq('activo', true),
      supabase.from('reportes_fallas').select('*', { count: 'exact', head: true }).neq('estado', 'resuelto'),
      supabase.from('reportes_fallas').select('*', { count: 'exact', head: true }).eq('gravedad', 'critica').neq('estado', 'resuelto'),
      supabase.from('checklists').select('*', { count: 'exact', head: true }).gte('fecha', hoyInicio.toISOString()),
      supabase.from('unidades').select('*, choferes(nombre)').neq('estado', 'verde').eq('activo', true).order('estado'),
    ])

    setStats({
      unidades: totalUnidades || 0,
      fallasPendientes: fallasPendientes || 0,
      fallasCriticas: fallasCriticas || 0,
      checklistsHoy: checklistsHoy || 0,
    })
    setUnidadesAlerta(unidadesData || [])
    setLoading(false)
  }

  return (
    <>
      <TopBar title="🛠️ Panel Admin" />
      <div className="content">
        {loading && <div className="loading-spinner">Cargando...</div>}

        {!loading && (
          <>
            <div className="stat-grid">
              <div className="stat-box">
                <div className="num">{stats.unidades}</div>
                <div className="lbl">Unidades activas</div>
              </div>
              <div className="stat-box">
                <div className="num" style={{ color: stats.checklistsHoy >= stats.unidades ? '#16a34a' : '#d97706' }}>
                  {stats.checklistsHoy}/{stats.unidades}
                </div>
                <div className="lbl">Checklists de hoy</div>
              </div>
              <div className="stat-box">
                <div className="num" style={{ color: stats.fallasPendientes > 0 ? '#d97706' : '#16a34a' }}>
                  {stats.fallasPendientes}
                </div>
                <div className="lbl">Fallas pendientes</div>
              </div>
              <div className="stat-box">
                <div className="num" style={{ color: stats.fallasCriticas > 0 ? '#dc2626' : '#16a34a' }}>
                  {stats.fallasCriticas}
                </div>
                <div className="lbl">Fallas críticas</div>
              </div>
            </div>

            <div className="card-title" style={{ marginLeft: 2 }}>Unidades que requieren atención</div>
            {unidadesAlerta.length === 0 && (
              <div className="card">
                <div className="empty-state" style={{ padding: 24 }}>
                  <div className="icon">✅</div>
                  <p>Toda la flota está en buen estado</p>
                </div>
              </div>
            )}
            {unidadesAlerta.map((u) => (
              <div key={u.id} className="unidad-card">
                <span className="estado-dot" style={{
                  background: u.estado === 'amarillo' ? '#d97706' : '#dc2626'
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
