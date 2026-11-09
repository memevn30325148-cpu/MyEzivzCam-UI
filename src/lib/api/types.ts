// Data contracts copied from the backend handoff document (Milestone 2).

export type CameraCapabilityType =
  | 'ptz_continuous'
  | 'ptz_preset'
  | 'two_way_audio'
  | 'audio_listen'
  | 'motion_detection'
  | 'human_detection'
  | 'siren_light'
  | 'sd_recording'
  | 'sd_playback'
  | 'night_vision_color'

export type PTZAction = 'up' | 'down' | 'left' | 'right' | 'stop'

export type StreamQuality = 'eco' | 'hd' | '2k'

export type UploadStatus =
  | 'PENDING'
  | 'UPLOADING'
  | 'COMPLETED'
  | 'FAILED'
  | 'RETRYING'
  | 'CORRUPT'
  | 'DEAD_LETTER'
  | 'BLOCKED_NO_CONSENT'
  | 'FILE_TOO_LARGE'

export interface CameraDevice {
  id: string
  canonical_id: string
  name: string
  model: string
  is_mock: boolean
  capabilities: CameraCapabilityType[]
  stream_url: string
}

export interface SecurityEvent {
  id: string
  camera_id: string
  event_type: 'motion_detected' | 'human_detection' | string
  start_time: string
  end_time: string
  duration: number
  size_kb: number
  status: UploadStatus
  telegram_message_id: number | null
  telegram_file_id: string | null
  checksum: string | null
}

export interface SystemStatus {
  ok: boolean
  provider_type: 'mock' | 'telegram'
  storage_provider: string
  retention_days: number
  consent_enabled: boolean
  queue_pending_count: number
  queue_dlq_count: number
  max_upload_bytes: number
  large_file_strategy: string
  is_mock_cameras: boolean
}

export interface MotionListenerStatus {
  camera_id: string
  camera_name: string
  is_running: boolean
  event_count: number
  last_motion_time: string | null
  last_event_id: string | null
}

export interface MotionStatus {
  enabled: boolean
  listeners: MotionListenerStatus[]
}

export interface SnapshotResult {
  camera_id: string
  camera_name: string
  filename: string
  file_size: number
  data_uri: string
}

export interface PtzResult {
  camera_id: string
  action: PTZAction
  is_mock: boolean
  message: string
}

export interface SignedPlayback {
  signed_url: string
  expires_at: number
}

export interface EventQuery {
  camera_id?: string
  date?: string
  limit?: number
}

/** Everything the UI needs from the backend. Implemented by the HTTP client and the demo backend. */
export interface CamApi {
  readonly mode: 'live' | 'demo'
  login(username: string, password: string): Promise<{ username: string }>
  me(): Promise<{ username: string }>
  logout(): Promise<void>
  cameras(): Promise<CameraDevice[]>
  /** URL for an <img> MJPEG stream. `null` means the UI should render a simulated feed. */
  liveStreamUrl(cameraId: string, quality: StreamQuality): string | null
  snapshot(cameraId: string): Promise<SnapshotResult>
  ptz(cameraId: string, action: PTZAction, speed: number): Promise<PtzResult>
  events(query: EventQuery): Promise<SecurityEvent[]>
  triggerAlarm(cameraId: string, eventType: string, duration: number): Promise<void>
  signPlayback(fileId: string, expiresIn?: number): Promise<SignedPlayback>
  systemStatus(): Promise<SystemStatus>
  motionStatus(): Promise<MotionStatus>
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    detail?: string,
  ) {
    super(detail || code)
    this.name = 'ApiError'
  }
}
