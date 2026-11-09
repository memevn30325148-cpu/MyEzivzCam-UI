/**
 * Demo fixtures: realistic sample data that mirrors the backend contract.
 * Used only when no real backend is connected (see `src/lib/api/index.ts`).
 */
import type {
  CameraDevice,
  SecurityEvent,
  SystemStatus,
  UploadStatus,
} from './types'

export const DEMO_USER = { username: 'admin', password: 'demo' }

/** Still frames used to simulate the live feed of each demo camera. */
export const DEMO_FRAMES: Record<string, string> = {
  'cam-1': '/img/cam-front.jpg',
  'cam-2': '/img/cam-back.jpg',
}

export const demoCameras: CameraDevice[] = [
  {
    id: 'cam-1',
    canonical_id: 'cam-1',
    name: 'Nhà Trước',
    model: 'EZVIZ CS-H8c-R100-1K3WKFL',
    is_mock: true,
    capabilities: [
      'ptz_continuous',
      'ptz_preset',
      'motion_detection',
      'human_detection',
      'audio_listen',
      'night_vision_color',
    ],
    stream_url: 'rtsp://admin:VERIFY_CODE@192.168.1.100:554/h264/ch1/main/av_stream',
  },
  {
    id: 'cam-2',
    canonical_id: 'cam-2',
    name: 'Sân Sau',
    model: 'EZVIZ CS-C3N',
    is_mock: true,
    capabilities: ['motion_detection', 'audio_listen'],
    stream_url: 'rtsp://admin:VERIFY_CODE@192.168.1.101:554/h264/ch1/main/av_stream',
  },
]

export const demoSystem: SystemStatus = {
  ok: true,
  provider_type: 'telegram',
  storage_provider: 'TelegramStorageProvider',
  retention_days: 365,
  consent_enabled: true,
  queue_pending_count: 1,
  queue_dlq_count: 1,
  max_upload_bytes: 52428800,
  large_file_strategy: 'DEAD_LETTER',
  is_mock_cameras: true,
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0')

/** Backend-style naive local ISO timestamp: 2026-11-09T14:30:00.123456 */
export function localIso(d: Date) {
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}000`
  )
}

const hex = (seed: number) => {
  let x = seed * 2654435761
  let s = ''
  for (let i = 0; i < 12; i++) {
    x = (x * 1103515245 + 12345) >>> 0
    s += (x >>> 24).toString(16).padStart(2, '0').slice(-1)
  }
  return s
}

type Seed = [hoursAgo: number, cam: string, type: string, status: UploadStatus, sizeKb: number]

const SEEDS: Seed[] = [
  [0.15, 'cam-1', 'human_detection', 'COMPLETED', 2450],
  [0.3, 'cam-1', 'motion_detected', 'COMPLETED', 2210],
  [0.7, 'cam-2', 'motion_detected', 'UPLOADING', 1980],
  [1.4, 'cam-1', 'human_detection', 'BLOCKED_NO_CONSENT', 2390],
  [2.8, 'cam-2', 'motion_detected', 'DEAD_LETTER', 2120],
  [3.6, 'cam-1', 'motion_detected', 'COMPLETED', 2050],
  [5.1, 'cam-2', 'human_detection', 'COMPLETED', 2600],
  [7.9, 'cam-1', 'motion_detected', 'COMPLETED', 1870],
  [9.4, 'cam-2', 'motion_detected', 'PENDING', 2010],
  [22, 'cam-1', 'human_detection', 'COMPLETED', 2480],
  [26, 'cam-2', 'motion_detected', 'COMPLETED', 1930],
  [30, 'cam-1', 'motion_detected', 'FAILED', 2290],
  [49, 'cam-2', 'human_detection', 'COMPLETED', 2540],
  [53, 'cam-1', 'motion_detected', 'COMPLETED', 2140],
  [75, 'cam-1', 'human_detection', 'COMPLETED', 2330],
]

export function makeEvent(
  start: Date,
  cameraId: string,
  type: string,
  status: UploadStatus,
  sizeKb: number,
  duration = 30,
  n = start.getTime(),
): SecurityEvent {
  const end = new Date(start.getTime() + duration * 1000)
  const ts = Math.floor(start.getTime() / 1000)
  const done = status === 'COMPLETED'
  return {
    id: `ev_motion_${ts}_${hex(n).slice(0, 6)}`,
    camera_id: cameraId,
    event_type: type,
    start_time: localIso(start),
    end_time: localIso(end),
    duration,
    size_kb: sizeKb,
    status,
    telegram_message_id: done ? 1400 + (n % 97) : null,
    telegram_file_id: done ? `BAACAgUAAxkBAAIC${hex(n + 7).toUpperCase()}` : null,
    checksum: status === 'PENDING' ? null : hex(n + 3),
  }
}

export function seedEvents(now = new Date()): SecurityEvent[] {
  return SEEDS.map(([h, cam, type, status, size], i) =>
    makeEvent(new Date(now.getTime() - h * 3600_000), cam, type, status, size, 30, i + 11),
  )
}
