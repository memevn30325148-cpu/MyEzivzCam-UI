import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { httpApi, onUnauthorized, probeBackend } from './http'
import { demoApi } from './demo'
import type { CamApi } from './types'

export * from './types'

type Phase = 'probing' | 'checking' | 'ready'

interface SessionValue {
  api: CamApi
  phase: Phase
  user: string | null
  setUser: (u: string | null) => void
  logout: () => Promise<void>
}

const SessionContext = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [api, setApi] = useState<CamApi>(httpApi)
  const [phase, setPhase] = useState<Phase>('probing')
  const [user, setUser] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const mode = await probeBackend()
      const chosen = mode === 'demo' ? demoApi : httpApi
      if (!alive) return
      setApi(chosen)
      setPhase('checking')
      try {
        const me = await chosen.me()
        if (alive) setUser(me.username)
      } catch {
        if (alive) setUser(null)
      } finally {
        if (alive) setPhase('ready')
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => onUnauthorized(() => setUser(null)), [])

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } finally {
      setUser(null)
    }
  }, [api])

  const value = useMemo(
    () => ({ api, phase, user, setUser, logout }),
    [api, phase, user, logout],
  )
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>')
  return ctx
}

export const useApi = () => useSession().api
