import type { AudioConfig, Library, Sound, SoundPatch } from '../shared/types'

export interface FawtboardApi {
  getLibrary(): Promise<Library>
  addFiles(): Promise<Sound[]>
  updateSound(id: string, patch: SoundPatch): Promise<void>
  removeSound(id: string): Promise<void>
  setAudio(patch: Partial<AudioConfig>): Promise<void>
  readSound(id: string): Promise<ArrayBuffer>
  onLibraryChanged(cb: (library: Library) => void): () => void
  onPlay(cb: (id: string) => void): () => void
  onStopAll(cb: () => void): () => void
}

declare global {
  interface Window {
    fawtboard: FawtboardApi
  }
}
