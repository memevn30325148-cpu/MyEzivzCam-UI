import { ApiError } from './types'
import type {
  CamApi,
  CameraDevice,
  EventQuery,
  MotionStatus,
  PtzResult,
  SecurityEvent,
  SignedPlayback,
  SnapshotResult,
  SystemStatus,
} from './types'

const BASE = '/api/v1'

type Listener = () => void
const unauthorizedListeners = new Set<Listener>()

/** Subscribe to "session lost" (any HTTP 401 outside of the login call). */
export function onUnauthorized(fn: Listener) {
  unauthorizedListeners.add(fn)
  return () => unauthorizedListeners.delete(fn)
}

export function emitUnauthorized() {
  unauthorizedListeners.forEach((fn) => fn())
}

async function request<T>(
  path: string,
  init: { method?: 'GET' | 'POST'; body?: unknown; skip401?: boolean } = {},
): Promise<T> {
  const method = init.method ?? 'GET'
  let res: Response
  try {
    res = await fetch(BASE + path, {
      method,
      credentials: 'include',
      // CSRF mitigation: every POST must be JSON or the backend answers 415.
      headers:
        method === 'POST'
          ? { 'Content-Type': 'application/json', Accept: 'application/json' }
          : { Accept: 'application/json' },
      body: method === 'POST' ? JSON.stringify(init.body ?? {}) : undefined,
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Không thể kết nối tới máy chủ.')
  }

  let data: Record<string, unknown> | null = null
  try {
    data = (await res.json()) as Record<string, unknown>
  } catch {
    data = null
  }

  if (!res.ok || !data || data.ok === false) {
    const code = (data?.error as string) || `HTTP_${res.status}`
    const detail = (data?.detail as string) || res.statusText
    if (res.status === 401 && !init.skip401) emitUnauthorized()
    throw new ApiError(res.status, code, detail)
  }
  return data as T
}

const qs = (params: Record<string, string | number | undefined>) => {
  const s = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') s.set(k, String(v))
  const out = s.toString()
  return out ? `?${out}` : ''
}

export const httpApi: CamApi = {
  mode: 'live',

  async login(username, password) {
    const r = await request<{ username: string }>('/auth/login', {
      method: 'POST',
      body: { username, password },
      skip401: true,
    })
    return { username: r.username }
  },
  async me() {
    const r = await request<{ username: string }>('/auth/me', { skip401: true })
    return { username: r.username }
  },
  async logout() {
    await request('/auth/logout', { method: 'POST', skip401: true })
  },
  async cameras() {
    return (await request<{ cameras: CameraDevice[] }>('/cameras')).cameras
  },
  liveStreamUrl(cameraId, quality) {
    return `${BASE}/stream/${encodeURIComponent(cameraId)}/live${qs({ quality, t: Date.now() })}`
  },
  snapshot(cameraId) {
    return request<SnapshotResult>('/snapshot/capture', {
      method: 'POST',
      body: { camera_id: cameraId },
    })
  },
  ptz(cameraId, action, speed) {
    return request<PtzResult>('/ptz/control', {
      method: 'POST',
      body: { camera_id: cameraId, action, speed },
    })
  },
  async events(q: EventQuery) {
    const r = await request<{ events: SecurityEvent[] }>(
      `/events${qs({ camera_id: q.camera_id, date: q.date, limit: q.limit })}`,
    )
    return r.events
  },
  async triggerAlarm(cameraId, eventType, duration) {
    await request('/alarm/trigger', {
      method: 'POST',
      body: { camera_id: cameraId, event_type: eventType, duration },
    })
  },
  signPlayback(fileId, expiresIn = 900) {
    return request<SignedPlayback>('/playback/sign', {
      method: 'POST',
      body: { file_id: fileId, expires_in: expiresIn },
    })
  },
  systemStatus() {
    return request<SystemStatus>('/system/status')
  },
  async motionStatus() {
    const r = await request<MotionStatus>('/motion/status')
    return { enabled: r.enabled, listeners: r.listeners }
  },
}

/**
 * Decide whether a real backend is reachable behind `/api/v1`.
 * The edge proxy answers 503 BACKEND_NOT_CONFIGURED when no backend URL is set;
 * a plain dev server answers with HTML. Both mean "use demo mode".
 */
export async function probeBackend(): Promise<'live' | 'demo'> {
  try {
    const res = await fetch(`${BASE}/auth/me`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    const type = res.headers.get('content-type') || ''
    if (!type.includes('json')) return 'demo'
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    if (!data) return 'demo'
    if (res.status === 503 && data.error === 'BACKEND_NOT_CONFIGURED') return 'demo'
    return 'live'
  } catch {
    return 'demo'
  }
}
