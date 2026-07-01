import { createContext, useContext, useState, useEffect } from 'react'
import { suscribirPush, pushSoportado } from './push'

const SessionContext = createContext(null)

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null)

  useEffect(() => {
    const saved = localStorage.getItem('flota_session')
    if (saved) {
      const s = JSON.parse(saved)
      setSession(s)
      if (s?.role === 'chofer' && pushSoportado() && Notification.permission === 'granted') {
        suscribirPush(s.id)
      }
    }
  }, [])

  const login = async (data) => {
    setSession(data)
    localStorage.setItem('flota_session', JSON.stringify(data))
    if (data?.role === 'chofer' && pushSoportado()) {
      setTimeout(() => suscribirPush(data.id), 2000)
    }
  }

  const logout = () => {
    setSession(null)
    localStorage.removeItem('flota_session')
  }

  return (
    <SessionContext.Provider value={{ session, login, logout }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  return useContext(SessionContext)
}
