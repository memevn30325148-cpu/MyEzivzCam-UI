import { useEffect, useRef, useState } from 'react'
import type { CameraDevice, StreamQuality } from '@/lib/api'
import { DEMO_FRAMES } from '@/lib/api/fixtures'
import { QUALITY, ddmmyyyy, hhmmss } from '@/lib/format'
import { IconExpand, IconPlay } from './icons'

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

function Reticle() {
  return (
    <svg
      className="reticle"
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      stroke="#38BDF8"
      strokeOpacity=".55"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <circle cx="60" cy="60" r="56" strokeDasharray="6 10" />
      <circle cx="60" cy="60" r="30" />
      <path d="M60 0v24M60 96v24M0 60h24M96 60h24" />
    </svg>
  )
}

/**
 * Live view. With a real backend it renders the MJPEG stream in an <img>; the
 * socket is released (`src = ""`) when paused, unmounted or the tab is hidden.
 * In demo mode it renders a still frame that pans with PTZ commands.
 */
export function LiveFeed({
  camera,
  streamUrl,
  quality,
  paused,
  onResume,
  pan,
  flashKey,
}: {
  camera: CameraDevice
  streamUrl: string | null
  quality: StreamQuality
  paused: boolean
  onResume: () => void
  pan: { x: number; y: number }
  flashKey: number
}) {
  const now = useNow()
  const box = useRef<HTMLDivElement>(null)
  const img = useRef<HTMLImageElement>(null)
  const [state, setState] = useState<'loading' | 'playing' | 'error'>('loading')
  const [hidden, setHidden] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const onVis = () => setHidden(document.visibilityState === 'hidden')
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const active = !paused && !hidden

  // Real MJPEG stream lifecycle.
  useEffect(() => {
    const el = img.current
    if (!streamUrl || !el) return
    if (!active) {
      el.src = ''
      return
    }
    setState('loading')
    const sep = streamUrl.includes('?') ? '&' : '?'
    el.src = `${streamUrl}${sep}r=${retry}`
    const poll = setInterval(() => {
      if (el.naturalWidth > 0) {
        setState('playing')
        clearInterval(poll)
      }
    }, 250)
    return () => {
      clearInterval(poll)
      el.src = ''
    }
  }, [streamUrl, active, retry])

  // Demo: simulate a short connection handshake on camera / quality change.
  useEffect(() => {
    if (streamUrl) return
    setState('loading')
    const t = setTimeout(() => setState('playing'), 700)
    return () => clearTimeout(t)
  }, [streamUrl, camera.id, quality])

  const flash = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!flashKey || !flash.current) return
    const el = flash.current
    el.classList.remove('go')
    void el.offsetWidth
    el.classList.add('go')
  }, [flashKey])

  const q = QUALITY[quality]

  return (
    <div ref={box} className={`vid ${quality}`}>
      {streamUrl ? (
        <img
          ref={img}
          className="feed"
          alt={`Trực tiếp ${camera.name}`}
          onError={(e) => {
            if (active && e.currentTarget.getAttribute('src')) setState('error')
          }}
          style={{ visibility: state === 'playing' && active ? 'visible' : 'hidden' }}
        />
      ) : (
        <img
          className="feed sim"
          alt={`Trực tiếp ${camera.name} (mô phỏng)`}
          src={DEMO_FRAMES[camera.id]}
          style={{
            objectPosition: `${pan.x}% ${pan.y}%`,
            visibility: state === 'playing' ? 'visible' : 'hidden',
          }}
        />
      )}
      {!streamUrl && <div className="grain" />}

      <div className="ov" style={{ top: 16, left: 16 }}>
        <span className={`dot ${active && state === 'playing' ? 'live' : 'off'}`} />
        {paused ? 'TẠM DỪNG' : 'TRỰC TIẾP'}
      </div>
      <div className="ov" style={{ top: 16, right: 16 }}>
        {q.label === 'Tiết kiệm' ? 'ECO' : q.label} · {q.res}
      </div>

      {(state === 'loading' || state === 'error') && active && (
        <div className="vid-center">
          <Reticle />
          {state === 'loading' ? (
            <div style={{ fontWeight: 500 }}>Đang tải luồng trực tiếp…</div>
          ) : (
            <>
              <div style={{ fontWeight: 600, color: '#fff' }}>Mất kết nối luồng trực tiếp</div>
              <button className="btn p" onClick={() => setRetry((r) => r + 1)}>
                Thử lại
              </button>
            </>
          )}
        </div>
      )}

      {paused && (
        <div className="vid-center dim">
          <button className="play-btn" aria-label="Tiếp tục xem" onClick={onResume}>
            <IconPlay size={26} />
          </button>
          <div style={{ fontWeight: 500 }}>Luồng đã ngắt để tiết kiệm băng thông</div>
        </div>
      )}

      <div className="ov" style={{ bottom: 16, left: 16 }}>
        {camera.name} · {ddmmyyyy(now)} {hhmmss(now)}
      </div>
      <button
        className="ov"
        style={{ bottom: 16, right: 16, border: 0, color: '#fff', cursor: 'pointer', width: 30, padding: 0, justifyContent: 'center' }}
        aria-label="Toàn màn hình"
        onClick={() => {
          const el = box.current
          if (!el) return
          if (document.fullscreenElement) void document.exitFullscreen()
          else void el.requestFullscreen?.()
        }}
      >
        <IconExpand size={15} />
      </button>
      <div ref={flash} className="flash" />
    </div>
  )
}
