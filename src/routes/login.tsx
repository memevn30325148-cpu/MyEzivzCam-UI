import { useEffect, useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Logo, Splash } from '@/components/app/app-shell'
import { IconAlert, IconClock, IconShield } from '@/components/app/icons'
import { ApiError, useSession } from '@/lib/api'
import { DEMO_USER } from '@/lib/api/fixtures'

export const Route = createFileRoute('/login')({
  head: () => ({ meta: [{ title: 'Đăng nhập · MyEzvizCam Pro' }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === 'string' ? s.redirect : undefined,
  }),
  component: LoginPage,
})

const safeRedirect = (r?: string) => (r && r.startsWith('/') && !r.startsWith('//') && !r.startsWith('/login') ? r : '/')

function HeroArt() {
  return (
    <svg className="art" width="520" height="520" viewBox="0 0 520 520" fill="none" aria-hidden="true">
      <g stroke="#38BDF8" strokeWidth="1.5">
        <circle cx="260" cy="260" r="250" strokeOpacity=".12" />
        <circle cx="260" cy="260" r="190" strokeOpacity=".2" strokeDasharray="4 10" />
        <circle cx="260" cy="260" r="120" strokeOpacity=".35" />
        <circle cx="260" cy="260" r="56" strokeOpacity=".6" />
        <path d="M260 0v120M260 400v120M0 260h120M400 260h120" strokeOpacity=".3" />
      </g>
      <circle cx="260" cy="260" r="8" fill="#38BDF8" />
      <path d="M260 260 L470 150 A240 240 0 0 1 498 260 Z" fill="url(#sweep)" />
      <defs>
        <linearGradient id="sweep" x1="260" y1="260" x2="500" y2="200" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38BDF8" stopOpacity=".35" />
          <stop offset="1" stopColor="#38BDF8" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function LoginPage() {
  const { api, phase, user, setUser } = useSession()
  const router = useRouter()
  const { redirect } = Route.useSearch()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<{ text: string; locked?: boolean } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (phase === 'ready' && user) router.history.replace(safeRedirect(redirect))
  }, [phase, user, redirect, router])

  if (phase !== 'ready') return <Splash />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) {
      setError({ text: 'Vui lòng nhập tên đăng nhập và mật khẩu.' })
      return
    }
    setBusy(true)
    setError(null)
    try {
      const r = await api.login(username.trim(), password)
      setUser(r.username)
    } catch (err) {
      const ae = err as ApiError
      if (ae.status === 429) {
        setError({
          text: 'Tài khoản tạm thời bị khóa do thử sai quá nhiều lần. Vui lòng thử lại sau 15 phút.',
          locked: true,
        })
      } else if (ae.status === 401) {
        setError({ text: 'Tên đăng nhập hoặc mật khẩu không đúng.' })
      } else {
        setError({ text: 'Không thể kết nối tới máy chủ. Vui lòng kiểm tra mạng và thử lại.' })
      }
      setPassword('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <div className="login-hero">
        <Logo dark />
        <HeroArt />
        <div style={{ position: 'relative', maxWidth: 460 }}>
          <h2>
            Mọi góc nhìn,
            <br />
            <span style={{ color: 'var(--sky)' }}>một nơi an toàn.</span>
          </h2>
          <div className="lead" style={{ marginTop: 18, color: '#CBD5E1', fontSize: 16, lineHeight: 1.6 }}>
            Giám sát camera ONVIF thời gian thực, lưu trữ clip sự kiện trên Telegram Cloud Vault.
          </div>
        </div>
      </div>

      <form className="login-form" onSubmit={(e) => void submit(e)} noValidate>
        <div>
          <h1>Đăng nhập</h1>
          <div style={{ color: 'var(--muted)', marginTop: 6 }}>Dùng tài khoản quản trị để tiếp tục</div>
        </div>

        {error && (
          <div className="alert" role="alert">
            {error.locked ? <IconShield size={18} /> : <IconAlert size={18} />}
            <span>{error.text}</span>
          </div>
        )}

        {api.mode === 'demo' && (
          <div className="li" style={{ background: 'var(--sky-50)', color: 'var(--sky-900)', flexWrap: 'nowrap' }}>
            <span style={{ lineHeight: 1.5 }}>
              <b>Chế độ demo</b> — chưa kết nối máy chủ camera. Đăng nhập bằng{' '}
              <b>{DEMO_USER.username}</b> / <b>{DEMO_USER.password}</b>.
            </span>
            <button
              type="button"
              className="btn"
              style={{ height: 36, flex: 'none' }}
              onClick={() => {
                setUsername(DEMO_USER.username)
                setPassword(DEMO_USER.password)
              }}
            >
              Điền sẵn
            </button>
          </div>
        )}

        <div>
          <label className="lb" htmlFor="u">
            Tên đăng nhập
          </label>
          <input
            className="in"
            id="u"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={busy}
          />
        </div>
        <div>
          <label className="lb" htmlFor="p">
            Mật khẩu
          </label>
          <input
            className="in"
            id="p"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
          />
        </div>
        <button className="btn p" type="submit" style={{ height: 52, fontSize: 15 }} disabled={busy}>
          {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
        <div style={{ color: 'var(--muted)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconClock size={16} /> Phiên đăng nhập có hiệu lực 12 giờ
        </div>
      </form>
    </div>
  )
}
