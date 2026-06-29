import { NavLink } from 'react-router-dom'
import { useSession } from '../lib/SessionContext'

export default function BottomNav() {
  const { session } = useSession()
  const isAdmin = session?.role === 'admin'

  const items = isAdmin
    ? [
        { to: '/', icon: '🏠', label: 'Inicio' },
        { to: '/unidades', icon: '🚚', label: 'Unidades' },
        { to: '/fallas', icon: '⚠️', label: 'Fallas' },
        { to: '/reparaciones', icon: '🔧', label: 'Reparac.' },
        { to: '/combustible', icon: '⛽', label: 'Combustible' },
        { to: '/vencimientos', icon: '📋', label: 'VTV/SENASA' },
        { to: '/choferes', icon: '👨‍✈️', label: 'Choferes' },
        { to: '/alertas', icon: '🔔', label: 'Alertas' },
      ]
    : [
        { to: '/', icon: '🏠', label: 'Inicio' },
        { to: '/checklist', icon: '✅', label: 'Checklist' },
        { to: '/reportar', icon: '⚠️', label: 'Reportar' },
        { to: '/combustible', icon: '⛽', label: 'Combustible' },
        { to: '/vencimientos', icon: '🪪', label: 'VTV/SENASA' },
        { to: '/historial', icon: '📋', label: 'Historial' },
      ]

  return (
    <nav className="bottom-nav">
      <div className="bottom-nav-inner">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            end
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
