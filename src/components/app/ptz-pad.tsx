import { useCallback, useEffect, useRef, useState } from 'react'
import type { PTZAction } from '@/lib/api'
import { ApiError } from '@/lib/api'
import { PTZ_LABEL } from '@/lib/format'

const KEYS: Record<string, PTZAction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

/**
 * Press-and-hold PTZ pad. Pressing a direction sends the move command,
 * releasing sends `stop`. Status text follows the UX rules from the backend
 * handoff (no raw backend messages, auto-clear after 1–3 s).
 */
export function PtzPad({
  enabled,
  send,
  onActiveChange,
}: {
  enabled: boolean
  send: (action: PTZAction, speed: number) => Promise<unknown>
  onActiveChange?: (action: PTZAction | null, speed: number) => void
}) {
  const [speed, setSpeed] = useState(0.6)
  const [active, setActive] = useState<PTZAction | null>(null)
  const [msg, setMsg] = useState('')
  const [fade, setFade] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const activeRef = useRef<PTZAction | null>(null)

  const show = useCallback((text: string, clearAfter?: number) => {
    clearTimeout(timer.current)
    setMsg(text)
    setFade(false)
    if (clearAfter) {
      timer.current = setTimeout(() => setFade(true), clearAfter)
    }
  }, [])

  useEffect(() => () => clearTimeout(timer.current), [])

  const fire = useCallback(
    async (action: PTZAction) => {
      if (!enabled) return
      if (action === 'stop') {
        activeRef.current = null
        setActive(null)
        onActiveChange?.(null, speed)
        show(PTZ_LABEL.stop, 1000)
      } else {
        activeRef.current = action
        setActive(action)
        onActiveChange?.(action, speed)
        show(PTZ_LABEL[action], 3000)
      }
      try {
        await send(action, speed)
      } catch (e) {
        const err = e as ApiError
        activeRef.current = null
        setActive(null)
        onActiveChange?.(null, speed)
        show(
          err.code === 'CAPABILITY_UNSUPPORTED'
            ? 'Camera không hỗ trợ xoay PTZ'
            : 'Không gửi được lệnh, thử lại',
          3000,
        )
      }
    },
    [enabled, send, speed, show, onActiveChange],
  )

  const release = useCallback(() => {
    if (activeRef.current) void fire('stop')
  }, [fire])

  // Keyboard arrows (desktop).
  useEffect(() => {
    if (!enabled) return
    const isTyping = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
    const down = (e: KeyboardEvent) => {
      const a = KEYS[e.key]
      if (!a || e.repeat || isTyping(e.target)) return
      e.preventDefault()
      void fire(a)
    }
    const up = (e: KeyboardEvent) => {
      if (KEYS[e.key] && !isTyping(e.target)) release()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [enabled, fire, release])

  const dir = (action: PTZAction, label: string, glyph: string) => (
    <button
      className={`pt${active === action ? ' a' : ''}`}
      aria-label={label}
      title={label}
      disabled={!enabled}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        void fire(action)
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      {glyph}
    </button>
  )

  return (
    <div className="card">
      <div className="h" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Điều khiển PTZ</span>
        {!enabled && <span style={{ textTransform: 'none', letterSpacing: 0 }}>Camera cố định</span>}
      </div>
      <div className="ptz" style={{ opacity: enabled ? 1 : 0.55 }}>
        <span />
        {dir('up', 'Xoay lên', '▲')}
        <span />
        {dir('left', 'Quay trái', '◄')}
        <button className="pt k" aria-label="Dừng" title="Dừng" disabled={!enabled} onClick={() => void fire('stop')}>
          ■
        </button>
        {dir('right', 'Quay phải', '►')}
        <span />
        {dir('down', 'Xoay xuống', '▼')}
        <span />
      </div>
      <div className={`ptz-msg${fade ? ' fade' : ''}`} aria-live="polite">
        {enabled ? msg : 'Camera này không hỗ trợ xoay quét'}
      </div>
      <div className="kv">
        <span>Tốc độ</span>
        <b>{speed.toFixed(1)}</b>
      </div>
      <input
        type="range"
        min="0.1"
        max="1"
        step="0.1"
        value={speed}
        disabled={!enabled}
        aria-label="Tốc độ xoay"
        onChange={(e) => setSpeed(Number(e.target.value))}
      />
    </div>
  )
}
