/**
 * In-browser demo backend implementing the same contract as the Python API.
 * It lets the app be explored end-to-end before a real backend is connected.
 */
import { ApiError } from './types'
import type { CamApi, SecurityEvent } from './types'
import {
  DEMO_FRAMES,
  DEMO_USER,
  demoCameras,
  demoSystem,
  makeEvent,
  seedEvents,
} from './fixtures'
import { emitUnauthorized } from './http'

const SESSION_KEY = 'ezviz-demo-session'
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

let events: SecurityEvent[] | null = null
const getEvents = () => (events ??= seedEvents())

// Brute-force simulation: 5 failures in 10 minutes → 15 minute lock.
const failures: number[] = []
let lockedUntil = 0

const hasSession = () => {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? Number(raw) > Date.now() : false
  } catch {
    return false
  }
}

function requireSession() {
  if (!hasSession()) {
    emitUnauthorized()
    throw new ApiError(401, 'UNAUTHORIZED', 'Session expired.')
  }
}

function camera(id: string) {
  const cam = demoCameras.find((c) => c.id === id)
  if (!cam) throw new ApiError(404, 'NOT_FOUND', `Camera ${id} not found.`)
  return cam
}

async function captureFrame(cameraId: string): Promise<{ uri: string; size: number }> {
  const img = new Image()
  img.src = DEMO_FRAMES[cameraId]
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  const stamp = `${camera(cameraId).name} · ${new Date().toLocaleString('vi-VN')}`
  ctx.font = '600 22px Inter, system-ui, sans-serif'
  const w = ctx.measureText(stamp).width + 28
  ctx.fillStyle = 'rgba(11,15,20,.72)'
  ctx.beginPath()
  ctx.roundRect(20, canvas.height - 62, w, 40, 20)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.fillText(stamp, 34, canvas.height - 34)
  const uri = canvas.toDataURL('image/jpeg', 0.9)
  return { uri, size: Math.round((uri.length - 23) * 0.75) }
}

export const demoApi: CamApi = {
  mode: 'demo',

  async login(username, password) {
    await wait(450)
    const now = Date.now()
    if (lockedUntil > now) {
      throw new ApiError(429, 'TOO_MANY_REQUESTS', 'Account temporarily locked.')
    }
    if (username === DEMO_USER.username && password === DEMO_USER.password) {
      failures.length = 0
      localStorage.setItem(SESSION_KEY, String(now + 12 * 3600_000))
      return { username }
    }
    failures.push(now)
    while (failures.length && failures[0] < now - 10 * 60_000) failures.shift()
    if (failures.length >= 5) {
      lockedUntil = now + 15 * 60_000
      failures.length = 0
      throw new ApiError(429, 'TOO_MANY_REQUESTS', 'Account temporarily locked.')
    }
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid credentials.')
  },
  async me() {
    await wait(120)
    if (!hasSession()) throw new ApiError(401, 'UNAUTHORIZED', 'Not logged in.')
    return { username: DEMO_USER.username }
  },
  async logout() {
    await wait(150)
    localStorage.removeItem(SESSION_KEY)
  },
  async cameras() {
    requireSession()
    await wait(200)
    return demoCameras
  },
  liveStreamUrl() {
    return null
  },
  async snapshot(cameraId) {
    requireSession()
    const cam = camera(cameraId)
    const { uri, size } = await captureFrame(cameraId)
    return {
      camera_id: cam.id,
      camera_name: cam.name,
      filename: `snap_${cam.id}_${Math.floor(Date.now() / 1000)}.jpg`,
      file_size: size,
      data_uri: uri,
    }
  },
  async ptz(cameraId, action) {
    requireSession()
    const cam = camera(cameraId)
    await wait(90)
    if (!cam.capabilities.includes('ptz_continuous')) {
      throw new ApiError(
        400,
        'CAPABILITY_UNSUPPORTED',
        `Camera [${cam.name}] does not support PTZ capability.`,
      )
    }
    return {
      camera_id: cam.id,
      action,
      is_mock: true,
      message: `Thực thi thành công trên camera giả lập [${cam.name}]`,
    }
  },
  async events({ camera_id, date, limit = 50 }) {
    requireSession()
    await wait(260)
    return getEvents()
      .filter((e) => !camera_id || e.camera_id === camera_id)
      .filter((e) => !date || e.start_time.startsWith(date))
      .sort((a, b) => b.start_time.localeCompare(a.start_time))
      .slice(0, limit)
  },
  async triggerAlarm(cameraId, eventType, duration) {
    requireSession()
    camera(cameraId)
    await wait(300)
    const ev = makeEvent(new Date(), cameraId, eventType, 'UPLOADING', 0, duration)
    getEvents().unshift(ev)
    // Simulate the upload pipeline finishing a few seconds later.
    setTimeout(() => {
      ev.status = 'COMPLETED'
      ev.size_kb = 80 * duration + 40
      ev.telegram_file_id = `BAACAgUAAxkBAAIC${ev.id.slice(-6).toUpperCase()}`
      ev.telegram_message_id = 1500
      ev.checksum = ev.id.slice(-12)
    }, 4000)
  },
  async signPlayback(fileId, expiresIn = 900) {
    requireSession()
    await wait(180)
    const expires = Math.floor(Date.now() / 1000) + expiresIn
    return {
      signed_url: `demo:${fileId}?expires=${expires}`,
      expires_at: expires,
    }
  },
  async systemStatus() {
    requireSession()
    await wait(200)
    const list = getEvents()
    return {
      ...demoSystem,
      queue_pending_count: list.filter((e) =>
        ['PENDING', 'UPLOADING', 'RETRYING'].includes(e.status),
      ).length,
      queue_dlq_count: list.filter((e) => e.status === 'DEAD_LETTER').length,
    }
  },
  async motionStatus() {
    requireSession()
    await wait(200)
    const list = getEvents()
    return {
      enabled: true,
      listeners: demoCameras.map((c) => {
        const mine = list.filter((e) => e.camera_id === c.id)
        return {
          camera_id: c.id,
          camera_name: c.name,
          is_running: true,
          event_count: mine.length,
          last_motion_time: mine[0]?.start_time ?? null,
          last_event_id: mine[0]?.id ?? null,
        }
      }),
    }
  },
}

/** Resolve a demo signed URL back to the still frame of the event's camera. */
export function demoFrameForEvent(ev: SecurityEvent) {
  return DEMO_FRAMES[ev.camera_id] ?? DEMO_FRAMES['cam-1']
}
