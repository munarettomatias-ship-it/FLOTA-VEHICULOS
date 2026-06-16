import { createContext, useContext, useState, useEffect } from 'react'

const SessionContext = createContext(null)

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null)

  useEffect(() => {
    const saved = localStorage.getItem('flota_session')
    if (saved) setSession(JSON.parse(saved))
  }, [])

  const login = (data) => {
    setSession(data)
    localStorage.setItem('flota_session', JSON.stringify(data))
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
