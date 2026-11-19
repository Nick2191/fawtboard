export const AUDIO_EXTENSIONS = ['mp3', 'wav', 'flac', 'ogg', 'm4a']

/** URL scheme the renderer loads sound images from: `fawtboard-image://sound/<Sound.image>`. */
export const IMAGE_SCHEME = 'fawtboard-image'

export type PlayMode = 'restart' | 'overlap' | 'toggle'

export type Sound = {
  id: string
  name: string
  filePath: string
  volume: number
  mode: PlayMode
  /** Palette key (see renderer `lib/colors`). Unset sounds get a stable colour derived from their id. */
  color?: string
  /** File name of this sound's picture in the app's images folder, shown on its pad and Stream Deck key. */
  image?: string
  /** Set while filePath is a trimmed copy in the app's sounds folder. */
  trim?: SoundTrim
}

/** Where a trimmed sound was cut from: the original file and the kept range, in seconds. */
export type SoundTrim = { source: string; start: number; end: number }

/** What the trimmer edits: the original when it is still readable, else the sound's current file. */
export type TrimSource = {
  bytes: ArrayBuffer
  /** File the bytes came from; becomes `SoundTrim.source` when a trim is saved. */
  path: string
  /** The saved range within `path`; null when `path` is not a trimmed sound's original. */
  range: { start: number; end: number } | null
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
  /** Install downloaded updates when fawtboard quits or next starts, without asking. */
  autoUpdate: boolean
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

export type UpdateStatus = {
  /** Version of the running app. */
  version: string
  /** `unsupported`: this build can't update itself (development, or not the Windows installer). */
  state: 'unsupported' | 'idle' | 'checking' | 'downloading' | 'ready' | 'error'
  /** The newer version being downloaded (`downloading`) or waiting to install (`ready`). */
  available?: string
  /** Plugin version bundled with this app, set while the connected Stream Deck plugin is older. */
  pluginUpdate?: string
}
