import {
  SYSTEM_DEFAULT_DEVICE,
  type DeviceRef,
  type Library,
  type Sound
} from '../../../shared/types'

type SinkId = string | { type: 'none' }

/** Where an output currently goes. `missing`: a device was chosen but is not plugged in. */
export type Route =
  | { kind: 'off' }
  | { kind: 'default' }
  | { kind: 'device'; device: MediaDeviceInfo }
  | { kind: 'missing'; label: string }

class AudioOutput {
  readonly ctx = new AudioContext({ latencyHint: 'interactive' })
  readonly master = this.ctx.createGain()
  readonly buffers = new Map<string, AudioBuffer>()
  private readonly active = new Map<string, Set<AudioBufferSourceNode>>()
  private sink: SinkId = ''

  /** `onEnded` fires whenever a playing source finishes or is stopped. */
  constructor(private readonly onEnded: () => void) {
    this.master.connect(this.ctx.destination)
  }

  /** Routes this output to a device, the system default, or silence. */
  async setRoute(route: Route): Promise<void> {
    const next: SinkId =
      route.kind === 'device'
        ? route.device.deviceId
        : route.kind === 'default'
          ? ''
          : { type: 'none' }
    if (JSON.stringify(next) === JSON.stringify(this.sink)) return
    this.sink = next
    await this.ctx.setSinkId(next)
  }

  async load(id: string, bytes: ArrayBuffer): Promise<void> {
    // decodeAudioData detaches its input, so each output decodes its own copy.
    this.buffers.set(id, await this.ctx.decodeAudioData(bytes.slice(0)))
  }

  unload(id: string): void {
    this.stop(id)
    this.buffers.delete(id)
  }

  isPlaying(id: string): boolean {
    return (this.active.get(id)?.size ?? 0) > 0
  }

  get playingCount(): number {
    return this.active.size
  }

  start(id: string, volume: number): void {
    const buffer = this.buffers.get(id)
    if (!buffer) return
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    const gain = new GainNode(this.ctx, { gain: volume })
    source.connect(gain).connect(this.master)
    let set = this.active.get(id)
    if (!set) {
      set = new Set()
      this.active.set(id, set)
    }
    const playing = set
    playing.add(source)
    source.onended = () => {
      playing.delete(source)
      gain.disconnect()
      if (playing.size === 0 && this.active.get(id) === playing) this.active.delete(id)
      this.onEnded()
    }
    source.start()
  }

  stop(id: string): void {
    for (const source of this.active.get(id) ?? []) source.stop()
  }

  stopAll(): void {
    for (const id of this.active.keys()) this.stop(id)
  }

  /** Two short rising notes, so a device can be identified without adding a sound first. */
  testTone(): void {
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    const now = this.ctx.currentTime
    ;[660, 880].forEach((frequency, i) => {
      const start = now + i * 0.17
      const osc = new OscillatorNode(this.ctx, { frequency })
      const gain = new GainNode(this.ctx, { gain: 0 })
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.35, start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16)
      osc.connect(gain).connect(this.master)
      osc.onended = () => gain.disconnect()
      osc.start(start)
      osc.stop(start + 0.17)
    })
  }
}

/** Real output devices; "default"/"communications" are aliases that would double-list a device. */
async function listOutputs(): Promise<MediaDeviceInfo[]> {
  const enumerate = async (): Promise<MediaDeviceInfo[]> =>
    (await navigator.mediaDevices.enumerateDevices()).filter(
      (d) => d.kind === 'audiooutput' && d.deviceId !== 'default' && d.deviceId !== 'communications'
    )
  let outputs = await enumerate()
  if (outputs.length > 0 && outputs.every((d) => !d.label)) {
    // Labels stay hidden until media permission has been exercised once.
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((t) => t.stop())
    outputs = await enumerate()
  }
  return outputs
}

/** Device ids are salted per origin (dev vs packaged differ), so fall back to the label. */
export function resolveRoute(ref: DeviceRef, outputs: MediaDeviceInfo[]): Route {
  if (!ref) return { kind: 'off' }
  if (ref.deviceId === SYSTEM_DEFAULT_DEVICE.deviceId) return { kind: 'default' }
  const device =
    outputs.find((d) => d.deviceId === ref.deviceId) ?? outputs.find((d) => d.label === ref.label)
  return device ? { kind: 'device', device } : { kind: 'missing', label: ref.label }
}

export type OutputName = 'monitor' | 'broadcast'

export type SoundState = 'loading' | 'ready' | 'error'

export class AudioEngine extends EventTarget {
  private readonly onEnded = (): void => this.changed()
  readonly monitor = new AudioOutput(this.onEnded)
  readonly broadcast = new AudioOutput(this.onEnded)
  readonly errors = new Map<string, string>()
  outputs: MediaDeviceInfo[] = []
  /** False until the first device enumeration finishes; until then every device looks missing. */
  outputsReady = false
  private sounds = new Map<string, Sound>()
  private library: Library | null = null
  private readonly loading = new Set<string>()
  /** File each sound was last loaded from, to notice when a sound is pointed at another file. */
  private readonly loadedFrom = new Map<string, string>()
  private readonly playCounts = new Map<string, number>()

  constructor() {
    super()
    navigator.mediaDevices.addEventListener('devicechange', () => {
      void this.applyDevices()
    })
  }

  private get both(): AudioOutput[] {
    return [this.monitor, this.broadcast]
  }

  private changed(): void {
    this.dispatchEvent(new Event('change'))
  }

  route(name: OutputName): Route {
    return resolveRoute(this.library?.audio[name] ?? null, this.outputs)
  }

  private forget(id: string): void {
    this.both.forEach((o) => o.unload(id))
    this.errors.delete(id)
    this.loadedFrom.delete(id)
  }

  async sync(library: Library): Promise<void> {
    this.library = library
    this.sounds = new Map(library.sounds.map((s) => [s.id, s]))
    this.monitor.master.gain.value = library.audio.monitorVolume
    this.broadcast.master.gain.value = library.audio.broadcastVolume

    for (const [id, filePath] of [...this.loadedFrom]) {
      const sound = this.sounds.get(id)
      // A load still in flight cleans up after itself once it settles.
      if (this.loading.has(id)) continue
      if (!sound || sound.filePath !== filePath) this.forget(id)
    }
    for (const id of [...this.playCounts.keys()]) {
      if (!this.sounds.has(id)) this.playCounts.delete(id)
    }

    const pending = library.sounds.filter((s) => !this.loadedFrom.has(s.id))
    this.changed()
    await Promise.all([this.applyDevices(), ...pending.map((s) => this.loadSound(s))])
  }

  private async loadSound({ id, filePath }: Sound): Promise<void> {
    this.loading.add(id)
    this.loadedFrom.set(id, filePath)
    let error: string | null = null
    try {
      const bytes = await window.fawtboard.readSound(id)
      // Chromium only says "Unable to decode audio data", which tells a user nothing.
      await Promise.all(this.both.map((o) => o.load(id, bytes))).catch(() => {
        throw new Error('This file is damaged or isn’t in an audio format fawtboard can play.')
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      // ipcRenderer.invoke wraps main-process errors; keep only the original message.
      error = message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
    }
    this.loading.delete(id)

    const current = this.sounds.get(id)
    if (!current) {
      this.forget(id)
    } else if (current.filePath !== filePath) {
      // Relinked while loading: what was decoded belongs to the old file.
      this.forget(id)
      void this.loadSound(current)
    } else if (error !== null) {
      this.both.forEach((o) => o.unload(id))
      this.errors.set(id, error)
    }
    this.changed()
  }

  private async applyDevices(): Promise<void> {
    try {
      this.outputs = await listOutputs()
    } catch (err) {
      console.error('Failed to enumerate audio outputs:', err)
      this.outputs = []
    }
    this.outputsReady = true
    const names: OutputName[] = ['monitor', 'broadcast']
    await Promise.all(
      names.map(async (name) => {
        try {
          await this[name].setRoute(this.route(name))
        } catch (err) {
          console.error(`Failed to route ${name} output:`, err)
        }
      })
    )
    this.changed()
  }

  state(id: string): SoundState {
    if (this.errors.has(id)) return 'error'
    return this.monitor.buffers.has(id) ? 'ready' : 'loading'
  }

  /** Length in seconds, once the sound has been decoded. */
  duration(id: string): number | undefined {
    return this.monitor.buffers.get(id)?.duration
  }

  /** Retries a sound that failed to load, e.g. after its drive was reconnected. */
  reload(id: string): void {
    const sound = this.sounds.get(id)
    if (!sound || this.loading.has(id)) return
    this.forget(id)
    void this.loadSound(sound)
    this.changed()
  }

  isPlaying(id: string): boolean {
    return this.both.some((o) => o.isPlaying(id))
  }

  /** How many times a sound has been started; changes on every (re)start, so it can key animations. */
  playCount(id: string): number {
    return this.playCounts.get(id) ?? 0
  }

  /** Number of distinct sounds currently audible. */
  get playingCount(): number {
    return this.monitor.playingCount
  }

  play(id: string): void {
    const sound = this.sounds.get(id)
    if (!sound || this.state(id) !== 'ready') return
    switch (sound.mode) {
      case 'restart':
        this.both.forEach((o) => o.stop(id))
        break
      case 'toggle':
        if (this.isPlaying(id)) {
          this.both.forEach((o) => o.stop(id))
          return
        }
        break
      case 'overlap':
        break
    }
    // Back to back: drift between the two devices is irrelevant (one is you, one is Discord).
    this.both.forEach((o) => o.start(id, sound.volume))
    this.playCounts.set(id, this.playCount(id) + 1)
    this.changed()
  }

  stop(id: string): void {
    this.both.forEach((o) => o.stop(id))
  }

  stopAll(): void {
    this.both.forEach((o) => o.stopAll())
  }

  testTone(name: OutputName): void {
    this[name].testTone()
  }
}
