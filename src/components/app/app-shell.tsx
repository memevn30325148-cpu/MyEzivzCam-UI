import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { useSession } from '@/lib/api'
import { IconCamera, IconClock, IconLogout, IconShield } from './icons'

const NAV = [
  { to: '/', label: 'Trực tiếp', short: 'Trực tiếp', Icon: IconCamera },
  { to: '/events', label: 'Sự kiện & Phát lại', short: 'Sự kiện', Icon: IconClock },
  { to: '/system', label: 'Hệ thống', short: 'Hệ thống', Icon: IconShield },
] as const

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <div className="logo">
      <div className="mark" style={dark ? { border: '1px solid #1E293B' } : undefined}>
        <IconCamera size={18} />
      </div>
      MyEzvizCam Pro
    </div>
  )
}

export function Splash({ text = 'Đang kết nối máy chủ…' }: { text?: string }) {
  return (
    <div className="splash">
      <div className="mark" style={{ width: 52, height: 52, borderRadius: 16 }}>
        <IconCamera size={26} />
      </div>
      <div style={{ fontWeight: 500 }}>{text}</div>
    </div>
  )
}

/** Authenticated layout: sidebar on desktop, top bar + bottom tabs on mobile. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { phase, user, logout, api } = useSession()
  const navigate = useNavigate()
  const { pathname, href } = useLocation()

  useEffect(() => {
    if (phase === 'ready' && !user) {
      void navigate({ to: '/login', search: { redirect: href }, replace: true })
    }
  }, [phase, user, navigate, href])

  if (phase !== 'ready' || !user) return <Splash />

  const isOn = (to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to))
  const initial = user.slice(0, 1)

  return (
    <div className="app">
      <aside className="side">
        <Logo />
        {NAV.map(({ to, label, Icon }) => (
          <Link key={to} to={to} className={`nav${isOn(to) ? ' on' : ''}`}>
            <Icon />
            {label}
          </Link>
        ))}
        {api.mode === 'demo' && (
          <div style={{ padding: '14px 8px 0' }}>
            <span className="chip demo" title="Chưa kết nối backend thật — đang dùng dữ liệu mẫu">
              ● Chế độ demo
            </span>
          </div>
        )}
        <div className="side-foot">
          <div className="avatar">{initial}</div>
          <div style={{ flex: 1, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user}
          </div>
          <button className="btn ib ghost" aria-label="Đăng xuất" title="Đăng xuất" onClick={() => void logout()}>
            <IconLogout size={18} />
          </button>
        </div>
      </aside>

      <header className="topbar">
        <Logo />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {api.mode === 'demo' && <span className="chip demo">Demo</span>}
          <div className="avatar" style={{ width: 32, height: 32 }}>
            {initial}
          </div>
          <button className="btn ib ghost" aria-label="Đăng xuất" onClick={() => void logout()}>
            <IconLogout size={18} />
          </button>
        </div>
      </header>

      <main className="main">{children}</main>

      <nav className="tabbar" aria-label="Điều hướng chính">
        {NAV.map(({ to, short, Icon }) => (
          <Link key={to} to={to} className={isOn(to) ? 'on' : ''}>
            <span className="pill">
              <Icon size={20} />
            </span>
            {short}
          </Link>
        ))}
      </nav>
    </div>
  )
}

export function PageHead({
  title,
  sub,
  children,
}: {
  title: string
  sub: string
  children?: React.ReactNode
}) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        <div className="sub">{sub}</div>
      </div>
      {children}
    </div>
  )
}
