import { EventEmitter } from 'events'
import { randomUUID } from 'crypto'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'fs'
import path from 'path'
import {
  AUDIO_EXTENSIONS,
  SYSTEM_DEFAULT_DEVICE,
  type AddResult,
  type AudioConfig,
  type Library,
  type Sound,
  type SoundPatch
} from '../shared/types'

function defaultLibrary(): Library {
  return {
    version: 1,
    sounds: [],
    // A fresh install should make noise on the first click, before any setup.
    audio: {
      monitor: SYSTEM_DEFAULT_DEVICE,
      broadcast: null,
      monitorVolume: 1,
      broadcastVolume: 1
    }
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
      audio: { ...defaults.audio, ...parsed.audio },
      ...(typeof parsed.importDir === 'string' ? { importDir: parsed.importDir } : {})
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

  /** Adds the audio files among `paths`; anything else (folders, other types) is counted as skipped. */
  addFiles(paths: string[]): AddResult {
    const audio = paths.filter((filePath) =>
      AUDIO_EXTENSIONS.includes(path.extname(filePath).slice(1).toLowerCase())
    )
    const added: Sound[] = audio.map((filePath) => ({
      id: randomUUID(),
      name: path.basename(filePath, path.extname(filePath)),
      filePath,
      volume: 1,
      mode: 'restart'
    }))
    if (added.length > 0) {
      this.commit({
        ...this.library,
        sounds: [...this.library.sounds, ...added],
        importDir: path.dirname(audio[audio.length - 1])
      })
    }
    return { added, skipped: paths.length - audio.length }
  }

  updateSound(id: string, patch: SoundPatch): void {
    const { name, volume, mode, color } = patch
    const clean: SoundPatch = {}
    if (name !== undefined) clean.name = name
    if (volume !== undefined) clean.volume = volume
    if (mode !== undefined) clean.mode = mode
    if (color !== undefined) clean.color = color
    this.patchSound(id, clean)
  }

  /** Points a sound at a different file, keeping its id so Stream Deck keys stay bound. */
  relinkSound(id: string, filePath: string): void {
    this.patchSound(id, { filePath })
  }

  removeSound(id: string): void {
    this.commit({ ...this.library, sounds: this.library.sounds.filter((s) => s.id !== id) })
  }

  /** Undoes a removal: puts `sound` back at `index` with its original id. */
  restoreSound(sound: Sound, index: number): void {
    if (this.findSound(sound.id)) return
    const sounds = [...this.library.sounds]
    sounds.splice(Math.max(0, Math.min(index, sounds.length)), 0, sound)
    this.commit({ ...this.library, sounds })
  }

  /** Reorders sounds to match `ids`; sounds missing from `ids` keep their relative order at the end. */
  reorder(ids: string[]): void {
    const rank = new Map(ids.map((id, i) => [id, i]))
    const sounds = [...this.library.sounds].sort(
      (a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity)
    )
    this.commit({ ...this.library, sounds })
  }

  setAudio(patch: Partial<AudioConfig>): void {
    this.commit({ ...this.library, audio: { ...this.library.audio, ...patch } })
  }

  private patchSound(id: string, patch: Partial<Sound>): void {
    this.commit({
      ...this.library,
      sounds: this.library.sounds.map((s) => (s.id === id ? { ...s, ...patch } : s))
    })
  }

  private commit(next: Library): void {
    this.library = next
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, JSON.stringify(next, null, 2))
    renameSync(tmp, this.file)
    this.emit('changed', next)
  }
}
