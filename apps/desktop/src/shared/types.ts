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

export type Library = {
  version: 1
  sounds: Sound[]
  audio: AudioConfig
  /** Folder sounds were last added from; the file picker reopens there. */
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
