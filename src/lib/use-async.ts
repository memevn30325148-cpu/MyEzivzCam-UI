import { useCallback, useEffect, useRef, useState } from 'react'

/** Minimal data hook: runs `fn` on mount/when deps change, optional polling. */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[],
  opts: { pollMs?: number; enabled?: boolean } = {},
) {
  const { pollMs, enabled = true } = opts
  const [data, setData] = useState<T | undefined>(undefined)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)
  const fnRef = useRef(fn)
  useEffect(() => {
    fnRef.current = fn
  })
  const seq = useRef(0)

  const run = useCallback(async (silent = false) => {
    const id = ++seq.current
    if (!silent) setLoading(true)
    try {
      const v = await fnRef.current()
      if (id === seq.current) {
        setData(v)
        setError(null)
      }
    } catch (e) {
      if (id === seq.current) setError(e as Error)
    } finally {
      if (id === seq.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    void run()
    if (!pollMs) return
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') void run(true)
    }, pollMs)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, pollMs, ...deps])

  return { data, error, loading, reload: () => run(true) }
}
