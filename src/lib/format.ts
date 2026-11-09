import type { CameraCapabilityType, PTZAction, StreamQuality, UploadStatus } from './api/types'

export const CAPABILITY_LABEL: Record<CameraCapabilityType, string> = {
  ptz_continuous: 'Xoay PTZ',
  ptz_preset: 'Preset PTZ',
  two_way_audio: 'Đàm thoại 2 chiều',
  audio_listen: 'Nghe âm thanh',
  motion_detection: 'Chuyển động',
  human_detection: 'Nhận diện người',
  siren_light: 'Còi & đèn',
  sd_recording: 'Ghi thẻ SD',
  sd_playback: 'Phát lại thẻ SD',
  night_vision_color: 'Đêm có màu',
}

export const QUALITY: Record<StreamQuality, { label: string; res: string }> = {
  eco: { label: 'Tiết kiệm', res: '768×432' },
  hd: { label: 'HD', res: '1280×720' },
  '2k': { label: '2K', res: '2304×1296' },
}

export const PTZ_LABEL: Record<PTZAction, string> = {
  up: '▲ Đang xoay lên',
  down: '▼ Đang xoay xuống',
  left: '◄ Đang quay trái',
  right: '► Đang quay phải',
  stop: '■ Đã dừng',
}

/** Badge class (b1..b4) + Vietnamese label per upload status. */
export const STATUS: Record<UploadStatus, { label: string; tone: 'b1' | 'b2' | 'b3' | 'b4' }> = {
  COMPLETED: { label: 'Đã lưu trữ', tone: 'b1' },
  PENDING: { label: 'Đang chờ xử lý', tone: 'b2' },
  UPLOADING: { label: 'Đang tải lên', tone: 'b2' },
  RETRYING: { label: 'Đang thử lại', tone: 'b2' },
  BLOCKED_NO_CONSENT: { label: 'Bị chặn · chưa đồng ý', tone: 'b3' },
  DEAD_LETTER: { label: 'Lỗi hàng đợi', tone: 'b4' },
  FAILED: { label: 'Tải lên thất bại', tone: 'b4' },
  CORRUPT: { label: 'Tệp hỏng', tone: 'b4' },
  FILE_TOO_LARGE: { label: 'Tệp quá lớn', tone: 'b4' },
}

export const eventTypeLabel = (t: string) =>
  t === 'human_detection'
    ? 'Phát hiện người'
    : t === 'motion_detected' || t === 'motion_detection'
      ? 'Chuyển động'
      : t.replace(/_/g, ' ')

/** Backend timestamps are naive local ISO strings. */
export const parseTime = (iso: string) => new Date(iso.replace(/(\.\d{3})\d+$/, '$1'))

const p2 = (n: number) => String(n).padStart(2, '0')
export const hhmm = (d: Date) => `${p2(d.getHours())}:${p2(d.getMinutes())}`
export const hhmmss = (d: Date) => `${hhmm(d)}:${p2(d.getSeconds())}`
export const ddmm = (d: Date) => `${p2(d.getDate())}/${p2(d.getMonth() + 1)}`
export const ddmmyyyy = (d: Date) => `${ddmm(d)}/${d.getFullYear()}`
export const isoDate = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`

export const clock = (sec: number) => {
  const s = Math.max(0, Math.floor(sec))
  return `${p2(Math.floor(s / 60))}:${p2(s % 60)}`
}

export const sizeKb = (kb: number) =>
  kb >= 1024
    ? `${(kb / 1024).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} MB`
    : `${kb.toLocaleString('vi-VN')} KB`

export const bytes = (b: number) =>
  b >= 1048576
    ? `${(b / 1048576).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} MB`
    : `${Math.round(b / 1024).toLocaleString('vi-VN')} KB`
