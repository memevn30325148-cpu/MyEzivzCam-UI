import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { AppShell, PageHead } from '@/components/app/app-shell'
import { LiveFeed } from '@/components/app/live-feed'
import { PtzPad } from '@/components/app/ptz-pad'
import { Sheet } from '@/components/app/sheet'
import { Kpi } from '@/components/app/kpi'
import { useToast } from '@/components/app/toast'
import { IconDownload, IconPause, IconPlay, IconSnap } from '@/components/app/icons'
import { useSession } from '@/lib/api'
import type { PTZAction, SnapshotResult, StreamQuality } from '@/lib/api'
import { useAsync } from '@/lib/use-async'
import { CAPABILITY_LABEL, QUALITY, bytes, hhmmss, isoDate, parseTime } from '@/lib/format'

export const Route = createFileRoute('/')({
  component: () => (
    <AppShell>
      <LivePage />
    </AppShell>
  ),
})

const CAM_KEY = 'ezviz-cam'
const Q_KEY = 'ezviz-quality'

function LivePage() {
  const { api } = useSession()
  const toast = useToast()

  const cams = useAsync(() => api.cameras(), [api])
  const sys = useAsync(() => api.systemStatus(), [api], { pollMs: 15000 })
  const motion = useAsync(() => api.motionStatus(), [api], { pollMs: 10000 })
  const today = useAsync(() => api.events({ date: isoDate(new Date()), limit: 500 }), [api], {
    pollMs: 30000,
  })

  const [camId, setCamId] = useState<string | null>(null)
  const [quality, setQuality] = useState<StreamQuality>('hd')
  const [paused, setPaused] = useState(false)
  const [snap, setSnap] = useState<SnapshotResult | null>(null)
  const [snapping, setSnapping] = useState(false)
  const [flashKey, setFlashKey] = useState(0)
  const [pan, setPan] = useState({ x: 50, y: 50 })

  useEffect(() => {
    setQuality((localStorage.getItem(Q_KEY) as StreamQuality) || 'hd')
  }, [])

  const list = cams.data ?? []
  const camera = list.find((c) => c.id === camId) ?? list[0]

  useEffect(() => {
    if (!camId && list.length) {
      const saved = localStorage.getItem(CAM_KEY)
      setCamId(list.some((c) => c.id === saved) ? saved : list[0].id)
    }
  }, [camId, list])

  const pickCam = (id: string) => {
    setCamId(id)
    setPan({ x: 50, y: 50 })
    localStorage.setItem(CAM_KEY, id)
  }
  const pickQuality = (q: StreamQuality) => {
    setQuality(q)
    localStorage.setItem(Q_KEY, q)
  }

  const streamUrl = useMemo(
    () => (camera ? api.liveStreamUrl(camera.id, quality) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, camera?.id, quality],
  )

  const hasPtz = !!camera?.capabilities.includes('ptz_continuous')

  // Demo mode: pan the simulated frame while a PTZ direction is held.
  const panTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const onPtzActive = useCallback(
    (action: PTZAction | null, speed: number) => {
      clearInterval(panTimer.current)
      if (api.mode !== 'demo' || !action || action === 'stop') return
      const step = 2 + speed * 6
      const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[action]
      const tick = () =>
        setPan((p) => ({
          x: Math.min(100, Math.max(0, p.x + d[0] * step)),
          y: Math.min(100, Math.max(0, p.y + d[1] * step)),
        }))
      tick()
      panTimer.current = setInterval(tick, 160)
    },
    [api.mode],
  )
  useEffect(() => () => clearInterval(panTimer.current), [])

  const sendPtz = useCallback(
    (action: PTZAction, speed: number) => api.ptz(camera!.id, action, speed),
    [api, camera],
  )

  const capture = async () => {
    if (!camera) return
    setSnapping(true)
    setFlashKey((k) => k + 1)
    try {
      setSnap(await api.snapshot(camera.id))
    } catch {
      toast('Không chụp được ảnh, vui lòng thử lại')
    } finally {
      setSnapping(false)
    }
  }

  const listener = motion.data?.listeners.find((l) => l.camera_id === camera?.id)
  const running = motion.data?.listeners.filter((l) => l.is_running).length
  const lastMotion = listener?.last_motion_time ? hhmmss(parseTime(listener.last_motion_time)) : '—'

  return (
    <>
      <PageHead title="Trực tiếp" sub="Giám sát thời gian thực các camera đang kết nối">
        {list.length > 0 && (
          <div className="seg" role="group" aria-label="Chọn camera">
            {list.map((c) => (
              <button key={c.id} className={c.id === camera?.id ? 'on' : ''} onClick={() => pickCam(c.id)}>
                {c.name}
              </button>
            ))}
          </div>
        )}
      </PageHead>

      <div className="kpi">
        <Kpi label="Camera trực tuyến" value={cams.data ? `${running ?? list.length} / ${list.length}` : undefined} />
        <Kpi label="Sự kiện hôm nay" value={today.data ? String(today.data.length) : undefined} />
        <Kpi label="Hàng đợi tải lên" value={sys.data ? `${sys.data.queue_pending_count} chờ` : undefined} />
        <Kpi
          label="Kho lưu trữ"
          value={sys.data ? (sys.data.provider_type === 'telegram' ? 'Telegram' : 'Giả lập') : undefined}
        />
      </div>

      {cams.error && !cams.data ? (
        <div className="card empty">
          Không tải được danh sách camera.{' '}
          <button className="btn" style={{ marginLeft: 8 }} onClick={() => void cams.reload()}>
            Thử lại
          </button>
        </div>
      ) : !camera ? (
        <div className="card">
          <div className="skel" style={{ aspectRatio: '16/9' }} />
        </div>
      ) : (
        <div className="g1">
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{camera.name}</div>
                <div style={{ color: 'var(--muted)', marginTop: 2 }}>{camera.model}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {camera.capabilities
                  .filter((c) => c !== 'ptz_preset' && c !== 'motion_detection')
                  .map((c) => (
                    <span key={c} className="chip">
                      {CAPABILITY_LABEL[c] ?? c}
                    </span>
                  ))}
              </div>
            </div>

            <LiveFeed
              camera={camera}
              streamUrl={streamUrl}
              quality={quality}
              paused={paused}
              onResume={() => setPaused(false)}
              pan={pan}
              flashKey={flashKey}
            />

            <div className="ctrl-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div className="seg accent" role="group" aria-label="Chất lượng">
                {(Object.keys(QUALITY) as StreamQuality[]).map((q) => (
                  <button key={q} className={q === quality ? 'on' : ''} onClick={() => pickQuality(q)}>
                    {QUALITY[q].label}
                  </button>
                ))}
              </div>
              <div className="actions" style={{ display: 'flex', gap: 10 }}>
                <button className="btn" onClick={() => setPaused((p) => !p)}>
                  {paused ? <IconPlay size={16} /> : <IconPause size={18} />}
                  {paused ? 'Tiếp tục' : 'Tạm dừng'}
                </button>
                <button className="btn p" onClick={() => void capture()} disabled={snapping || paused}>
                  <IconSnap size={18} /> {snapping ? 'Đang chụp…' : 'Chụp ảnh'}
                </button>
              </div>
            </div>
          </div>

          <div className="stack">
            <PtzPad key={camera.id} enabled={hasPtz} send={sendPtz} onActiveChange={onPtzActive} />
            <div className="card">
              <div className="h">Phát hiện chuyển động</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600, fontSize: 16 }}>
                <span
                  className={`dot ${listener?.is_running ? 'live' : 'off'}`}
                  style={{ width: 10, height: 10, borderRadius: 5 }}
                />
                {!motion.data
                  ? 'Đang kiểm tra…'
                  : !motion.data.enabled
                    ? 'Đã tắt tự động phát hiện'
                    : listener?.is_running
                      ? 'Đang lắng nghe (ONVIF)'
                      : 'Không lắng nghe'}
              </div>
              <div className="kv" style={{ marginTop: 14 }}>
                <span>Số sự kiện</span>
                <b>{listener?.event_count ?? '—'}</b>
              </div>
              <div className="kv">
                <span>Gần nhất</span>
                <b>{lastMotion}</b>
              </div>
            </div>
          </div>
        </div>
      )}

      {snap && (
        <Sheet title="Ảnh chụp nhanh" onClose={() => setSnap(null)}>
          <img src={snap.data_uri} alt={`Ảnh chụp ${snap.camera_name}`} style={{ width: '100%', borderRadius: 14 }} />
          <div>
            <div className="kv first">
              <span>Camera</span>
              <b>{snap.camera_name}</b>
            </div>
            <div className="kv">
              <span>Tệp</span>
              <b>{snap.filename}</b>
            </div>
            <div className="kv">
              <span>Dung lượng</span>
              <b>{bytes(snap.file_size)}</b>
            </div>
          </div>
          <a className="btn p" href={snap.data_uri} download={snap.filename}>
            <IconDownload size={18} /> Tải ảnh về máy
          </a>
        </Sheet>
      )}
    </>
  )
}
