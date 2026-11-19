import { randomUUID } from 'crypto'
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'fs'
import path from 'path'

/** Trimmed copies of sounds, kept as WAVs in the app's data folder. Originals are never touched. */
export class TrimmedSounds {
  constructor(private readonly dir: string) {
    mkdirSync(dir, { recursive: true })
  }

  /** Writes the WAV under a fresh name and returns its full path. */
  save(wav: Uint8Array): string {
    const file = path.join(this.dir, `${randomUUID()}.wav`)
    writeFileSync(file, wav)
    return file
  }

  /**
   * Deletes copies no sound uses. Only run at startup: within a session a replaced or removed
   * copy has to stay on disk so that undoing a sound's removal still finds it.
   */
  prune(inUse: Set<string>): void {
    for (const name of readdirSync(this.dir)) {
      const file = path.join(this.dir, name)
      if (!inUse.has(file)) rmSync(file, { force: true })
    }
  }
}
