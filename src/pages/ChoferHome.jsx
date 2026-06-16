import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/SessionContext'
import { getUnidadDeChofer } from '../lib/cache'
import TopBar from '../components/TopBar'

export default function ChoferHome() {
  const { session } = useSession()
  const navigate = useNavigate()
  const [unidad, setUnidad] = useState(null)
  const [ultimoChecklist, setUltimoChecklist] = useState(null)
  const [fallasPendientes, setFallasPendientes] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    setLoading(true)
    const unidadData = await getUnidadDeChofer(session.id)
    setUnidad(unidadData)

    if (unidadData) {
      // Estas dos consultas son independientes entre sí: se disparan en
      // paralelo en vez de esperar una y después la otra.
      const [{ data: checklistData }, { count }] = await Promise.all([
        supabase
          .from('checklists')
          .select('*')
          .eq('unidad_id', unidadData.id)
          .order('fecha', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('reportes_fallas')
          .select('*', { count: 'exact', head: true })
          .eq('unidad_id', unidadData.id)
          .neq('estado', 'resuelto'),
      ])
      setUltimoChecklist(checklistData)
      setFallasPendientes(count || 0)
    }
    setLoading(false)
  }

  const hoy = new Date().toLocaleDateString('es-AR')
  const checklistHoy = ultimoChecklist &&
    new Date(ultimoChecklist.fecha).toLocaleDateString('es-AR') === hoy

  return (
    <>
      <TopBar title="🚚 Mi Unidad" />
      <div className="content">
        {loading && <div className="loading-spinner">Cargando...</div>}

        {!loading && !unidad && (
          <div className="card">
            <div className="empty-state">
              <div className="icon">🚫</div>
              <p>No tenés una unidad asignada todavía.<br />Consultá con el administrador.</p>
            </div>
          </div>
        )}

        {!loading && unidad && (
          <>
            <div className="card">
              <div className="card-title">
                <span className="estado-dot" style={{
                  background: unidad.estado === 'verde' ? '#16a34a'
                    : unidad.estado === 'amarillo' ? '#d97706' : '#dc2626'
                }} />
                Patente {unidad.patente}
              </div>
              <div style={{ fontSize: 14, color: '#475569', marginBottom: 4 }}>
                {unidad.marca} {unidad.modelo} {unidad.anio ? `(${unidad.anio})` : ''}
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8' }}>
                Kilometraje actual: {unidad.km_actual?.toLocaleString('es-AR') || 0} km
              </div>
            </div>

            <div className="stat-grid">
              <div className="stat-box">
                <div className="num" style={{ color: checklistHoy ? '#16a34a' : '#dc2626' }}>
                  {checklistHoy ? '✓' : '✗'}
                </div>
                <div className="lbl">Checklist de hoy</div>
              </div>
              <div className="stat-box">
                <div className="num" style={{ color: fallasPendientes > 0 ? '#dc2626' : '#16a34a' }}>
                  {fallasPendientes}
                </div>
                <div className="lbl">Fallas pendientes</div>
              </div>
            </div>

            {!checklistHoy && (
              <button className="btn btn-primary" onClick={() => navigate('/checklist')}>
                ✅ Completar checklist de hoy
              </button>
            )}
            {checklistHoy && (
              <div className="card" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                <span style={{ fontSize: 13.5, color: '#16a34a', fontWeight: 600 }}>
                  ✓ Ya completaste el checklist de hoy
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
