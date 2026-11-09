import { useEffect, useState, useSyncExternalStore } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { AppShell, PageHead } from '@/components/app/app-shell'
import { EventPlayer } from '@/components/app/event-player'
import { Sheet } from '@/components/app/sheet'
import { useToast } from '@/components/app/toast'
import { IconBolt, IconPlay } from '@/components/app/icons'
import { useSession } from '@/lib/api'
import type { SecurityEvent } from '@/lib/api'
import { useAsync } from '@/lib/use-async'
import { STATUS, ddmm, eventTypeLabel, hhmm, isoDate, parseTime } from '@/lib/format'

export const Route = createFileRoute('/events')({
  head: () => ({ meta: [{ title: 'Sự kiện & Phát lại · MyEzvizCam Pro' }] }),
  component: () => (
    <AppShell>
      <EventsPage />
    </AppShell>
  ),
})

const COMPACT = '(max-width: 1024px)'
function useCompact() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(COMPACT)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(COMPACT).matches,
    () => false,
  )
}

function EventsPage() {
  const { api } = useSession()
  const toast = useToast()
  const compact = useCompact()

  const [camFilter, setCamFilter] = useState('')
  const [date, setDate] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [triggering, setTriggering] = useState(false)

  useEffect(() => setDate(isoDate(new Date())), [])

  const cams = useAsync(() => api.cameras(), [api])
  const evs = useAsync(
    () => api.events({ camera_id: camFilter || undefined, date: date || undefined, limit: 100 }),
    [api, camFilter, date],
    { pollMs: 8000, enabled: date !== '' },
  )

  const list = evs.data ?? []
  const cameras = cams.data ?? []
  const camName = (id: string) => cameras.find((c) => c.id === id)?.name ?? id
  const current = list.find((e) => e.id === selected) ?? (compact ? undefined : list[0])

  const open = (ev: SecurityEvent) => {
    setSelected(ev.id)
    if (compact) setSheetOpen(true)
  }

  const trigger = async () => {
    const camId = camFilter || cameras[0]?.id
    if (!camId) return
    setTriggering(true)
    try {
      await api.triggerAlarm(camId, 'motion_detected', 5)
      toast(`Đang ghi clip 5 giây từ ${camName(camId)}`)
      setDate(isoDate(new Date()))
      void evs.reload()
    } catch {
      toast('Không tạo được clip thủ công')
    } finally {
      setTriggering(false)
    }
  }

  return (
    <>
      <PageHead title="Sự kiện & Phát lại" sub="Clip đã được kiểm tra toàn vẹn và lưu trữ trên Telegram Cloud Vault">
        <div className="filters" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div className="seg" role="group" aria-label="Lọc theo camera">
            <button className={camFilter === '' ? 'on' : ''} onClick={() => setCamFilter('')}>
              Tất cả camera
            </button>
            {cameras.map((c) => (
              <button key={c.id} className={camFilter === c.id ? 'on' : ''} onClick={() => setCamFilter(c.id)}>
                {c.name}
              </button>
            ))}
          </div>
          <input
            className="in"
            type="date"
            value={date}
            max={isoDate(new Date())}
            onChange={(e) => setDate(e.target.value || isoDate(new Date()))}
            aria-label="Ngày"
            style={{ width: 170, height: 52 }}
          />
          <button className="btn" style={{ height: 52 }} onClick={() => void trigger()} disabled={triggering || !cameras.length}>
            <IconBolt size={18} /> {triggering ? 'Đang ghi…' : 'Ghi clip thủ công'}
          </button>
        </div>
      </PageHead>

      <div className="g2">
        <div className="card" style={{ padding: 12 }}>
          {evs.loading && !evs.data ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 4 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="skel" style={{ height: 52 }} />
              ))}
            </div>
          ) : evs.error && !evs.data ? (
            <div className="empty">
              Không tải được danh sách sự kiện.{' '}
              <button className="btn" onClick={() => void evs.reload()}>
                Thử lại
              </button>
            </div>
          ) : list.length === 0 ? (
            <div className="empty">
              <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>Không có sự kiện</div>
              Chưa ghi nhận chuyển động nào trong ngày đã chọn.
            </div>
          ) : (
            <>
              <div className="ev-table" style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: 660 }}>
                  <div className="row hd">
                    <span>Thời gian</span>
                    <span>Camera</span>
                    <span>Loại</span>
                    <span>Thời lượng</span>
                    <span>Trạng thái</span>
                    <span />
                  </div>
                  {list.map((ev) => {
                    const t = parseTime(ev.start_time)
                    const st = STATUS[ev.status] ?? { label: ev.status, tone: 'b2' }
                    return (
                      <div
                        key={ev.id}
                        className={`row${current?.id === ev.id ? ' sel' : ''}`}
                        onClick={() => open(ev)}
                      >
                        <b style={{ fontWeight: 600 }}>
                          {hhmm(t)} · {ddmm(t)}
                        </b>
                        <span>{camName(ev.camera_id)}</span>
                        <span>{eventTypeLabel(ev.event_type)}</span>
                        <span>{ev.duration} giây</span>
                        <span className={`b ${st.tone}`}>
                          <i />
                          {st.label}
                        </span>
                        <button
                          className="btn p ib"
                          aria-label="Xem lại"
                          disabled={ev.status !== 'COMPLETED'}
                          onClick={(e) => {
                            e.stopPropagation()
                            open(ev)
                          }}
                        >
                          <IconPlay size={16} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="ev-cards">
                {list.map((ev) => {
                  const t = parseTime(ev.start_time)
                  const st = STATUS[ev.status] ?? { label: ev.status, tone: 'b2' }
                  return (
                    <button
                      key={ev.id}
                      className="li"
                      style={{ border: 0, textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit', flexWrap: 'nowrap' }}
                      onClick={() => open(ev)}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700 }}>
                          {hhmm(t)} · {ddmm(t)}
                          <span style={{ fontWeight: 500, color: 'var(--muted)' }}> · {ev.duration}s</span>
                        </div>
                        <div style={{ color: 'var(--muted)', marginTop: 2 }}>
                          {eventTypeLabel(ev.event_type)} · {camName(ev.camera_id)}
                        </div>
                        <span className={`b ${st.tone}`} style={{ marginTop: 8 }}>
                          <i />
                          {st.label}
                        </span>
                      </div>
                      <span
                        className="btn p ib"
                        aria-hidden="true"
                        style={{ opacity: ev.status === 'COMPLETED' ? 1 : 0.35 }}
                      >
                        <IconPlay size={16} />
                      </span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {!compact && (
          <div className="player-col sticky">
            <div className="card">
              {current ? (
                <EventPlayer key={current.id} event={current} cameras={cameras} />
              ) : (
                <div className="empty">Chọn một sự kiện để xem lại</div>
              )}
            </div>
          </div>
        )}
      </div>

      {compact && sheetOpen && current && (
        <Sheet title="Xem lại sự kiện" onClose={() => setSheetOpen(false)}>
          <EventPlayer key={current.id} event={current} cameras={cameras} />
        </Sheet>
      )}
    </>
  )
}
