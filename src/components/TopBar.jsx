import { useSession } from '../lib/SessionContext'

export default function TopBar({ title, subtitle }) {
  const { session, logout } = useSession()

  return (
    <div className="topbar">
      <div className="topbar-titlegroup">
        <img src="/icons/logo-mimen.jpg" alt="Mimen" className="topbar-logo" />
        <div>
          <h1>{title}</h1>
          {subtitle && <div className="subtitle">{subtitle}</div>}
          {!subtitle && session && <div className="subtitle">{session.nombre}</div>}
        </div>
      </div>
      <button className="topbar-btn" onClick={logout}>
        🔄 Cambiar
      </button>
    </div>
  )
}
