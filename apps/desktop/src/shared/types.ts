export const AUDIO_EXTENSIONS = ['mp3', 'wav', 'flac', 'ogg', 'm4a']

export type PlayMode = 'restart' | 'overlap' | 'toggle'

export type Sound = {
  id: string
  name: string
  filePath: string
  volume: number
  mode: PlayMode
  /** Palette key (see renderer `lib/colors`). Unset sounds get a stable colour derived from their id. */
  color?: string
}

export type DeviceRef = { deviceId: string; label: string } | null

/** Follows whatever the OS currently treats as its default output. */
export const SYSTEM_DEFAULT_DEVICE = { deviceId: 'default', label: 'System default' }

export type AudioConfig = {
  monitor: DeviceRef
  broadcast: DeviceRef
  monitorVolume: number
  broadcastVolume: number
}

export const THEMES = ['system', 'light', 'dark'] as const

export type Theme = (typeof THEMES)[number]

export type Settings = {
  theme: Theme
  /** Accent key (see renderer `lib/accents`). */
  accent: string
  /** Folder the Add sounds picker opens in; null reopens wherever sounds were last added from. */
  addFolder: string | null
}

export type Library = {
  version: 1
  sounds: Sound[]
  audio: AudioConfig
  settings: Settings
  /** Folder sounds were last added from. */
  importDir?: string
}

export type SoundPatch = Partial<Pick<Sound, 'name' | 'volume' | 'mode' | 'color'>>

export type AddResult = { added: Sound[]; skipped: number }

export type StreamDeckStatus = {
  /** `unavailable`: the control port could not be opened, so no plugin can connect. */
  state: 'starting' | 'listening' | 'unavailable'
  clients: number
  port: number
}
