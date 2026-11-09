import { createContext, useCallback, useContext, useState } from 'react'
import { IconBolt } from './icons'

type Toast = { id: number; text: string }
const Ctx = createContext<(text: string) => void>(() => {})

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const push = useCallback((text: string) => {
    const id = Date.now() + Math.random()
    setItems((l) => [...l.slice(-2), { id, text }])
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 2800)
  }, [])
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toast-wrap" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="toast">
            <IconBolt size={16} />
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
