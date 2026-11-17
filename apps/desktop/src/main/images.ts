import { randomUUID } from 'crypto'
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { readFile } from 'fs/promises'
import path from 'path'

/**
 * Sound images, kept as small PNGs in the app's data folder. Unlike the sounds themselves these
 * are copies: the picture a user picks can be moved or deleted afterwards without losing it.
 */
export class SoundImages {
  constructor(private readonly dir: string) {
    mkdirSync(dir, { recursive: true })
  }

  /** Stores a PNG under a fresh name and returns it. A new name per image keeps caches honest. */
  save(png: Uint8Array): string {
    const name = `${randomUUID()}.png`
    writeFileSync(path.join(this.dir, name), png)
    return name
  }

  /** `name` can arrive in a URL or from a hand-edited library, so only its last segment is used. */
  file(name: string): string {
    return path.join(this.dir, path.basename(name))
  }

  async dataUrl(name: string): Promise<string | null> {
    try {
      return `data:image/png;base64,${(await readFile(this.file(name))).toString('base64')}`
    } catch {
      return null
    }
  }

  /**
   * Deletes images no sound uses. Only run at startup: within a session a replaced or removed
   * image has to stay on disk so that undoing a sound's removal still finds it.
   */
  prune(inUse: Set<string>): void {
    for (const name of readdirSync(this.dir)) {
      if (!inUse.has(name)) rmSync(path.join(this.dir, name), { force: true })
    }
  }
}
