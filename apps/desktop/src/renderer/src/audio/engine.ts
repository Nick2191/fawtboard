import type { DeviceRef, Library, Sound } from '../../../shared/types'

type SinkId = string | { type: 'none' }

class AudioOutput {
  readonly ctx = new AudioContext({ latencyHint: 'interactive' })
  readonly master = this.ctx.createGain()
  readonly buffers = new Map<string, AudioBuffer>()
  private readonly active = new Map<string, Set<AudioBufferSourceNode>>()
  private sink: SinkId = ''

  constructor() {
    this.master.connect(this.ctx.destination)
  }

  /** Routes this output to `deviceId`, or silences it when no device resolved. */
  async setDevice(deviceId: string | null): Promise<void> {
    const next: SinkId = deviceId ?? { type: 'none' }
    if (JSON.stringify(next) === JSON.stringify(this.sink)) return
    this.sink = next
    await this.ctx.setSinkId(next)
  }

  async load(id: string, bytes: ArrayBuffer): Promise<void> {
    // decodeAudioData detaches its input, so each output decodes its own copy.
    this.buffers.set(id, await this.ctx.decodeAudioData(bytes.slice(0)))
  }

  isPlaying(id: string): boolean {
    return (this.active.get(id)?.size ?? 0) > 0
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
    }
    source.start()
  }

  stop(id: string): void {
    for (const source of this.active.get(id) ?? []) source.stop()
  }

  stopAll(): void {
    for (const id of this.active.keys()) this.stop(id)
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
export function resolveDevice(ref: DeviceRef, outputs: MediaDeviceInfo[]): MediaDeviceInfo | null {
  if (!ref) return null
  return (
    outputs.find((d) => d.deviceId === ref.deviceId) ??
    outputs.find((d) => d.label === ref.label) ??
    null
  )
}

export type OutputName = 'monitor' | 'broadcast'

export class AudioEngine extends EventTarget {
  readonly monitor = new AudioOutput()
  readonly broadcast = new AudioOutput()
  readonly errors = new Map<string, string>()
  outputs: MediaDeviceInfo[] = []
  private sounds = new Map<string, Sound>()
  private library: Library | null = null
  private readonly loading = new Set<string>()

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

  /** Resolved device for an output, or null when unset or missing. */
  resolved(name: OutputName): MediaDeviceInfo | null {
    return resolveDevice(this.library?.audio[name] ?? null, this.outputs)
  }

  async sync(library: Library): Promise<void> {
    this.library = library
    this.sounds = new Map(library.sounds.map((s) => [s.id, s]))
    this.monitor.master.gain.value = library.audio.monitorVolume
    this.broadcast.master.gain.value = library.audio.broadcastVolume

    for (const output of this.both) {
      for (const id of [...output.buffers.keys()]) {
        if (!this.sounds.has(id)) {
          output.stop(id)
          output.buffers.delete(id)
        }
      }
    }
    for (const id of [...this.errors.keys()]) if (!this.sounds.has(id)) this.errors.delete(id)

    const pending = library.sounds.filter(
      (s) => !this.monitor.buffers.has(s.id) && !this.errors.has(s.id) && !this.loading.has(s.id)
    )
    this.changed()
    await Promise.all([this.applyDevices(), ...pending.map((s) => this.loadSound(s.id))])
  }

  private async loadSound(id: string): Promise<void> {
    this.loading.add(id)
    try {
      const bytes = await window.fawtboard.readSound(id)
      await Promise.all(this.both.map((o) => o.load(id, bytes)))
      if (!this.sounds.has(id)) this.both.forEach((o) => o.buffers.delete(id))
    } catch (err) {
      this.both.forEach((o) => o.buffers.delete(id))
      if (this.sounds.has(id)) {
        const message = err instanceof Error ? err.message : String(err)
        // ipcRenderer.invoke wraps main-process errors; keep only the original message.
        this.errors.set(
          id,
          message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
        )
      }
    } finally {
      this.loading.delete(id)
      this.changed()
    }
  }

  private async applyDevices(): Promise<void> {
    try {
      this.outputs = await listOutputs()
    } catch (err) {
      console.error('Failed to enumerate audio outputs:', err)
      this.outputs = []
    }
    const targets: [AudioOutput, OutputName][] = [
      [this.monitor, 'monitor'],
      [this.broadcast, 'broadcast']
    ]
    await Promise.all(
      targets.map(async ([output, name]) => {
        try {
          await output.setDevice(this.resolved(name)?.deviceId ?? null)
        } catch (err) {
          console.error(`Failed to route ${name} output:`, err)
        }
      })
    )
    this.changed()
  }

  isPlaying(id: string): boolean {
    return this.both.some((o) => o.isPlaying(id))
  }

  play(id: string): void {
    const sound = this.sounds.get(id)
    if (!sound || this.errors.has(id)) return
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
  }

  stopAll(): void {
    this.both.forEach((o) => o.stopAll())
  }
}
