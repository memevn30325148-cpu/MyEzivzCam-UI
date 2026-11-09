import { createFileRoute } from '@tanstack/react-router'
import { AppShell, PageHead } from '@/components/app/app-shell'
import { Kpi } from '@/components/app/kpi'
import { IconRefresh } from '@/components/app/icons'
import { useSession } from '@/lib/api'
import { useAsync } from '@/lib/use-async'
import { CAPABILITY_LABEL, bytes, hhmmss, parseTime } from '@/lib/format'

export const Route = createFileRoute('/system')({
  head: () => ({ meta: [{ title: 'Hệ thống · MyEzvizCam Pro' }] }),
  component: () => (
    <AppShell>
      <SystemPage />
    </AppShell>
  ),
})

const STRATEGY: Record<string, string> = {
  DEAD_LETTER: 'Chuyển vào hàng lỗi',
  SKIP: 'Bỏ qua',
  SPLIT: 'Chia nhỏ tệp',
  COMPRESS: 'Nén lại',
}

function SystemPage() {
  const { api } = useSession()
  const sys = useAsync(() => api.systemStatus(), [api], { pollMs: 10000 })
  const motion = useAsync(() => api.motionStatus(), [api], { pollMs: 10000 })
  const cams = useAsync(() => api.cameras(), [api])
  const s = sys.data

  const refresh = () => {
    void sys.reload()
    void motion.reload()
    void cams.reload()
  }

  return (
    <>
      <PageHead title="Hệ thống" sub="Tình trạng lưu trữ, hàng đợi và các camera đang giám sát">
        <button className="btn" onClick={refresh}>
          <IconRefresh size={18} /> Làm mới
        </button>
      </PageHead>

      <div className="kpi">
        <Kpi label="Hàng đợi chờ" value={s ? String(s.queue_pending_count) : undefined} />
        <Kpi label="Hàng đợi lỗi (DLQ)" value={s ? String(s.queue_dlq_count) : undefined} />
        <Kpi label="Lưu giữ" value={s ? `${s.retention_days} ngày` : undefined} />
        <Kpi label="Giới hạn tải lên" value={s ? bytes(s.max_upload_bytes) : undefined} />
      </div>

      <div className="g3">
        <div className="card">
          <div className="h">Lưu trữ &amp; quyền riêng tư</div>
          {!s ? (
            <div className="skel" style={{ height: 180 }} />
          ) : (
            <>
              <div className="kv first">
                <span>Nhà cung cấp</span>
                <b>
                  {s.provider_type === 'telegram' ? 'Telegram' : 'Giả lập'} · {s.storage_provider}
                </b>
              </div>
              <div className="kv">
                <span>Đồng ý tải lên</span>
                <b>
                  {s.consent_enabled ? (
                    <span className="chip">Đang bật</span>
                  ) : (
                    <span className="b b3">Đang tắt</span>
                  )}
                </b>
              </div>
              <div className="kv">
                <span>Tệp vượt giới hạn</span>
                <b>{STRATEGY[s.large_file_strategy] ?? s.large_file_strategy}</b>
              </div>
              <div className="kv">
                <span>Camera giả lập</span>
                <b>{s.is_mock_cameras ? 'Bật' : 'Tắt'}</b>
              </div>
              <div className="kv">
                <span>Phiên đăng nhập</span>
                <b>12 giờ</b>
              </div>
            </>
          )}
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="h" style={{ margin: 0 }}>
              Giám sát chuyển động ONVIF
            </div>
            {motion.data &&
              (motion.data.enabled ? <span className="chip">Đang bật</span> : <span className="b b3">Đang tắt</span>)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
            {!motion.data ? (
              <>
                <div className="skel" style={{ height: 64 }} />
                <div className="skel" style={{ height: 64 }} />
              </>
            ) : motion.data.listeners.length === 0 ? (
              <div className="empty">Chưa có camera nào được lắng nghe.</div>
            ) : (
              motion.data.listeners.map((l) => (
                <div key={l.camera_id} className="li">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{l.camera_name}</div>
                    <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2, overflowWrap: 'anywhere' }}>
                      {l.last_event_id ?? l.camera_id}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <span className={`b ${l.is_running ? 'b1' : 'b4'}`}>
                      <i />
                      {l.is_running ? 'Đang chạy' : 'Đã dừng'}
                    </span>
                    <span>{l.event_count} sự kiện</span>
                    <b>Gần nhất {l.last_motion_time ? hhmmss(parseTime(l.last_motion_time)) : '—'}</b>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ paddingTop: 8, paddingBottom: 8 }}>
        {!cams.data ? (
          <div className="skel" style={{ height: 120, margin: '12px 0' }} />
        ) : (
          cams.data.map((c, i) => (
            <div
              key={c.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
                padding: '16px 0',
                borderTop: i ? '1px solid var(--line-2)' : undefined,
              }}
            >
              <div style={{ minWidth: 200 }}>
                <div style={{ fontWeight: 600 }}>{c.name}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>{c.model}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
                {c.capabilities.map((cap) => (
                  <span key={cap} className="chip">
                    {CAPABILITY_LABEL[cap] ?? cap}
                  </span>
                ))}
                <span className="b b2">{c.is_mock ? 'Camera giả lập' : 'Camera thật'}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  )
}
