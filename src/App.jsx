import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SessionProvider, useSession } from './lib/SessionContext'
import BottomNav from './components/BottomNav'

import Login from './pages/Login'
import ChoferHome from './pages/ChoferHome'
import Checklist from './pages/Checklist'
import ReportarFalla from './pages/ReportarFalla'
import HistorialChofer from './pages/HistorialChofer'
import VencimientosChofer from './pages/VencimientosChofer'
import AdminHome from './pages/AdminHome'
import Unidades from './pages/Unidades'
import UnidadDetalle from './pages/UnidadDetalle'
import FallasAdmin from './pages/FallasAdmin'
import AlertasAdmin from './pages/AlertasAdmin'
import ChoferesAdmin from './pages/ChoferesAdmin'
import ReparacionesAdmin from './pages/ReparacionesAdmin'
import VencimientosAdmin from './pages/VencimientosAdmin'
import ChecklistsAdmin from './pages/ChecklistsAdmin'
import CombustibleChofer from './pages/CombustibleChofer'
import CombustibleAdmin from './pages/CombustibleAdmin'

function AppRoutes() {
  const { session } = useSession()

  if (!session) {
    return <Login />
  }

  const isAdmin = session.role === 'admin'

  return (
    <div className="app-shell">
      <Routes>
        {isAdmin ? (
          <>
            <Route path="/" element={<AdminHome />} />
            <Route path="/unidades" element={<Unidades />} />
            <Route path="/unidades/:id" element={<UnidadDetalle />} />
            <Route path="/fallas" element={<FallasAdmin />} />
            <Route path="/alertas" element={<AlertasAdmin />} />
            <Route path="/choferes" element={<ChoferesAdmin />} />
            <Route path="/reparaciones" element={<ReparacionesAdmin />} />
            <Route path="/vencimientos" element={<VencimientosAdmin />} />
            <Route path="/checklists" element={<ChecklistsAdmin />} />
            <Route path="/combustible" element={<CombustibleAdmin />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        ) : (
          <>
            <Route path="/" element={<ChoferHome />} />
            <Route path="/checklist" element={<Checklist />} />
            <Route path="/reportar" element={<ReportarFalla />} />
            <Route path="/historial" element={<HistorialChofer />} />
            <Route path="/vencimientos" element={<VencimientosChofer />} />
            <Route path="/combustible" element={<CombustibleChofer />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
      <BottomNav />
    </div>
  )
}

function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </SessionProvider>
  )
}

export default App
