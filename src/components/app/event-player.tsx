import { useCallback, useEffect, useRef, useState } from 'react'
import type { CameraDevice, SecurityEvent, SignedPlayback } from '@/lib/api'
import { ApiError, useSession } from '@/lib/api'
import { demoFrameForEvent } from '@/lib/api/demo'
import { STATUS, clock, ddmmyyyy, eventTypeLabel, hhmmss, parseTime, sizeKb } from '@/lib/format'
import { IconDownload, IconLink, IconLock, IconPause, IconPlay } from './icons'
import { useToast } from './toast'

const BLOCKED_COPY: Partial<Record<SecurityEvent['status'], string>> = {
  BLOCKED_NO_CONSENT: 'Clip bị chặn tải lên vì quyền riêng tư đang tắt.',
  DEAD_LETTER: 'Clip nằm trong hàng đợi lỗi và chưa thể phát.',
  FAILED: 'Tải lên thất bại, clip chưa có trên kho lưu trữ.',
  CORRUPT: 'Tệp bị hỏng khi kiểm tra toàn vẹn.',
  FILE_TOO_LARGE: 'Tệp vượt giới hạn tải lên của kho lưu trữ.',
  PENDING: 'Clip đang chờ xử lý, vui lòng quay lại sau.',
  UPLOADING: 'Clip đang được tải lên Telegram Cloud Vault…',
  RETRYING: 'Đang thử tải lên lại…',
}

/**
 * Event clip player. Playback uses the backend's two-step flow:
 * POST /playback/sign → <video src={signed_url}> (HTTP Range seeking).
 */
export function EventPlayer({ event, cameras }: { event: SecurityEvent; cameras: CameraDevice[] }) {
  const { api } = useSession()
  const toast = useToast()
  const video = useRef<HTMLVideoElement>(null)
  const [signed, setSigned] = useState<SignedPlayback | null>(null)
  const [signing, setSigning] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(event.duration)
  const [error, setError] = useState<string | null>(null)
  const [, force] = useState(0)
  const resigned = useRef(false)

  const playable = event.status === 'COMPLETED'
  const isDemo = signed?.signed_url.startsWith('demo:') ?? api.mode === 'demo'
  const cam = cameras.find((c) => c.id === event.camera_id)
  const start = parseTime(event.start_time)
  const st = STATUS[event.status] ?? { label: event.status, tone: 'b2' as const }

  // Release the network stream whenever the event changes or the player unmounts.
  useEffect(() => {
    setSigned(null)
    setPlaying(false)
    setTime(0)
    setDuration(event.duration)
    setError(null)
    resigned.current = false
    const el = video.current
    return () => {
      if (el) {
        el.pause()
        el.removeAttribute('src')
        el.load()
      }
    }
  }, [event.id, event.duration])

  // Expiry countdown refresh.
  useEffect(() => {
    if (!signed) return
    const t = setInterval(() => force((n) => n + 1), 15000)
    return () => clearInterval(t)
  }, [signed])

  // Demo playback clock.
  useEffect(() => {
    if (!isDemo || !playing) return
    const t = setInterval(() => {
      setTime((s) => {
        const n = s + 0.25
        if (n >= duration) {
          setPlaying(false)
          return duration
        }
        return n
      })
    }, 250)
    return () => clearInterval(t)
  }, [isDemo, playing, duration])

  const sign = useCallback(async () => {
    setSigning(true)
    setError(null)
    try {
      const s = await api.signPlayback(event.telegram_file_id ?? event.id, 900)
      setSigned(s)
      return s
    } catch (e) {
      const err = e as ApiError
      setError(err.status === 401 ? 'Phiên đăng nhập đã hết hạn.' : 'Không tạo được liên kết phát lại.')
      return null
    } finally {
      setSigning(false)
    }
  }, [api, event.id, event.telegram_file_id])

  const play = async () => {
    if (!playable) return
    let s = signed
    if (!s || s.expires_at * 1000 < Date.now()) s = await sign()
    if (!s) return
    if (s.signed_url.startsWith('demo:')) {
      if (time >= duration) setTime(0)
      setPlaying(true)
      return
    }
    const el = video.current
    if (!el) return
    if (el.getAttribute('src') !== s.signed_url) el.src = s.signed_url
    try {
      await el.play()
    } catch {
      /* autoplay / abort errors are surfaced via onError */
    }
  }

  const pause = () => {
    if (isDemo) setPlaying(false)
    else video.current?.pause()
  }

  const seek = (ratio: number) => {
    const t = Math.max(0, Math.min(duration, ratio * duration))
    if (isDemo) setTime(t)
    else if (video.current && signed) video.current.currentTime = t
  }

  const onVideoError = async () => {
    const el = video.current
    if (!el?.getAttribute('src')) return
    // Signed URL expired (401 URL_EXPIRED): sign again once and resume.
    if (!resigned.current && signed && signed.expires_at * 1000 < Date.now() + 5000) {
      resigned.current = true
      const s = await sign()
      if (s) {
        const at = el.currentTime
        el.src = s.signed_url
        el.currentTime = at
        void el.play().catch(() => {})
        return
      }
    }
    setPlaying(false)
    setError('Không phát được clip. Liên kết có thể đã hết hạn hoặc không hợp lệ.')
  }

  const download = async () => {
    if (!playable) return
    let s = signed
    if (!s || s.expires_at * 1000 < Date.now()) s = await sign()
    if (!s) return
    if (s.signed_url.startsWith('demo:')) {
      toast('Chế độ demo không có tệp video thật để tải xuống')
      return
    }
    const a = document.createElement('a')
    a.href = s.signed_url
    a.download = `${event.id}.mp4`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const minsLeft = signed ? Math.max(0, Math.ceil((signed.expires_at * 1000 - Date.now()) / 60000)) : null
  const progress = duration ? (time / duration) * 100 : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="vid">
        {playable && (
          <img
            className="feed sim"
            src={demoFrameForEvent(event)}
            alt=""
            style={{
              display: isDemo ? 'block' : 'none',
              transform: `scale(${1.12 + (time / Math.max(1, duration)) * 0.12})`,
              transition: 'transform .3s linear',
              filter: playing || time > 0 ? 'none' : 'brightness(.6)',
            }}
          />
        )}
        <video
          ref={video}
          playsInline
          preload="metadata"
          style={{ display: isDemo ? 'none' : 'block' }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setDuration(e.currentTarget.duration)}
          onError={() => void onVideoError()}
        />

        {!playable ? (
          <div className="vid-center">
            <IconLock size={34} />
            <span className={`b ${st.tone}`}>
              <i />
              {st.label}
            </span>
            <div style={{ maxWidth: 280, lineHeight: 1.5 }}>{BLOCKED_COPY[event.status] ?? 'Clip chưa sẵn sàng.'}</div>
          </div>
        ) : (
          !playing && (
            <div className="vid-center" style={{ background: time > 0 ? 'rgba(11,15,20,.25)' : undefined }}>
              <button className="play-btn" aria-label="Phát clip" onClick={() => void play()} disabled={signing}>
                {signing ? <span className="dot live" /> : <IconPlay size={26} />}
              </button>
              {error && <div style={{ color: '#fff', fontWeight: 500, maxWidth: 300 }}>{error}</div>}
            </div>
          )
        )}

        {playable && (
          <div className="scrub">
            <button className="mini" aria-label={playing ? 'Tạm dừng' : 'Phát'} onClick={() => (playing ? pause() : void play())}>
              {playing ? <IconPause size={14} /> : <IconPlay size={12} />}
            </button>
            <span>{clock(time)}</span>
            <div
              className="track"
              role="slider"
              aria-label="Tua clip"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={Math.round(time)}
              tabIndex={0}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect()
                seek((e.clientX - r.left) / r.width)
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') seek((time + 5) / duration)
                if (e.key === 'ArrowLeft') seek((time - 5) / duration)
              }}
            >
              <div className="bar">
                <div className="fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <span>{clock(duration)}</span>
          </div>
        )}
      </div>

      <div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>
          {eventTypeLabel(event.event_type)} · {cam?.name ?? event.camera_id}
        </div>
        <div style={{ color: 'var(--muted)', marginTop: 4 }}>
          {hhmmss(start)} · {ddmmyyyy(start)}
        </div>
      </div>

      <div>
        <div className="kv first">
          <span>Dung lượng</span>
          <b>{event.size_kb ? sizeKb(event.size_kb) : '—'}</b>
        </div>
        <div className="kv">
          <span>Thời lượng</span>
          <b>{event.duration} giây</b>
        </div>
        <div className="kv">
          <span>SHA-256</span>
          <b style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>{event.checksum ?? '—'}</b>
        </div>
        <div className="kv">
          <span>Trạng thái</span>
          <b>
            <span className={`b ${st.tone}`}>
              <i />
              {st.label}
            </span>
          </b>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span className="chip">
          <IconLink size={14} />
          {minsLeft === null
            ? 'Liên kết hết hạn sau 15 phút'
            : minsLeft > 0
              ? `Liên kết hết hạn sau ${minsLeft} phút`
              : 'Liên kết đã hết hạn'}
        </span>
        <button className="btn" disabled={!playable || signing} onClick={() => void download()}>
          <IconDownload size={18} /> Tải xuống
        </button>
      </div>
    </div>
  )
}
