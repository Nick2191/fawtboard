import type {
  AddResult,
  AudioConfig,
  Library,
  Sound,
  SoundPatch,
  StreamDeckStatus
} from '../shared/types'

export interface FawtboardApi {
  getLibrary(): Promise<Library>
  /** Opens the file picker. */
  addFiles(): Promise<AddResult>
  addDroppedFiles(files: File[]): Promise<AddResult>
  updateSound(id: string, patch: SoundPatch): Promise<void>
  /** Opens the file picker to point a sound at another file; resolves false when cancelled. */
  relinkSound(id: string): Promise<boolean>
  removeSound(id: string): Promise<void>
  restoreSound(sound: Sound, index: number): Promise<void>
  reorderSounds(ids: string[]): Promise<void>
  setAudio(patch: Partial<AudioConfig>): Promise<void>
  readSound(id: string): Promise<ArrayBuffer>
  revealSound(id: string): Promise<void>
  getStreamDeckStatus(): Promise<StreamDeckStatus>
  onLibraryChanged(cb: (library: Library) => void): () => void
  onPlay(cb: (id: string) => void): () => void
  onStopAll(cb: () => void): () => void
  onStreamDeckStatus(cb: (status: StreamDeckStatus) => void): () => void
}

declare global {
  interface Window {
    fawtboard: FawtboardApi
  }
}
