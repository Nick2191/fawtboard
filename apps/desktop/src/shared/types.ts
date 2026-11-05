export type PlayMode = 'restart' | 'overlap' | 'toggle'

export type Sound = {
  id: string
  name: string
  filePath: string
  volume: number
  mode: PlayMode
}

export type DeviceRef = { deviceId: string; label: string } | null

export type AudioConfig = {
  monitor: DeviceRef
  broadcast: DeviceRef
  monitorVolume: number
  broadcastVolume: number
}

export type Library = { version: 1; sounds: Sound[]; audio: AudioConfig }

export type SoundPatch = Partial<Pick<Sound, 'name' | 'volume' | 'mode'>>
