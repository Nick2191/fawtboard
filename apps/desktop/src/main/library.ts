import { EventEmitter } from 'events'
import { randomUUID } from 'crypto'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'fs'
import path from 'path'
import type { AudioConfig, Library, Sound, SoundPatch } from '../shared/types'

function defaultLibrary(): Library {
  return {
    version: 1,
    sounds: [],
    audio: { monitor: null, broadcast: null, monitorVolume: 1, broadcastVolume: 1 }
  }
}

function loadLibrary(file: string): Library {
  if (!existsSync(file)) return defaultLibrary()
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as Library
    const defaults = defaultLibrary()
    return {
      version: 1,
      sounds: Array.isArray(parsed.sounds) ? parsed.sounds : [],
      audio: { ...defaults.audio, ...parsed.audio }
    }
  } catch (err) {
    const corrupt = path.join(path.dirname(file), `library.corrupt-${Date.now()}.json`)
    console.error(`library.json is unreadable, moved to ${corrupt}:`, err)
    renameSync(file, corrupt)
    return defaultLibrary()
  }
}

export class LibraryStore extends EventEmitter<{ changed: [Library] }> {
  private library: Library

  constructor(private readonly file: string) {
    super()
    this.library = loadLibrary(file)
  }

  get(): Library {
    return this.library
  }

  findSound(id: string): Sound | undefined {
    return this.library.sounds.find((s) => s.id === id)
  }

  addFiles(paths: string[]): Sound[] {
    const added: Sound[] = paths.map((filePath) => ({
      id: randomUUID(),
      name: path.basename(filePath, path.extname(filePath)),
      filePath,
      volume: 1,
      mode: 'restart'
    }))
    this.commit({ ...this.library, sounds: [...this.library.sounds, ...added] })
    return added
  }

  updateSound(id: string, patch: SoundPatch): void {
    const { name, volume, mode } = patch
    const clean: SoundPatch = {}
    if (name !== undefined) clean.name = name
    if (volume !== undefined) clean.volume = volume
    if (mode !== undefined) clean.mode = mode
    this.commit({
      ...this.library,
      sounds: this.library.sounds.map((s) => (s.id === id ? { ...s, ...clean } : s))
    })
  }

  removeSound(id: string): void {
    this.commit({ ...this.library, sounds: this.library.sounds.filter((s) => s.id !== id) })
  }

  setAudio(patch: Partial<AudioConfig>): void {
    this.commit({ ...this.library, audio: { ...this.library.audio, ...patch } })
  }

  private commit(next: Library): void {
    this.library = next
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, JSON.stringify(next, null, 2))
    renameSync(tmp, this.file)
    this.emit('changed', next)
  }
}
