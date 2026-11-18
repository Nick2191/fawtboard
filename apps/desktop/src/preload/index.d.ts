import type {
  AddResult,
  AudioConfig,
  Library,
  Settings,
  Sound,
  SoundPatch,
  StreamDeckStatus,
  UpdateStatus
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
  setSettings(patch: Partial<Settings>): Promise<void>
  /** Opens a folder picker for the Add sounds folder; resolves false when cancelled. */
  chooseAddFolder(): Promise<boolean>
  readSound(id: string): Promise<ArrayBuffer>
  revealSound(id: string): Promise<void>
  /** Opens the file picker and resolves with the chosen image's bytes, or null when cancelled. */
  pickImage(): Promise<ArrayBuffer | null>
  /** `png` is the prepared key image; null removes the sound's image. */
  setSoundImage(id: string, png: ArrayBuffer | null): Promise<void>
  getStreamDeckStatus(): Promise<StreamDeckStatus>
  getUpdateStatus(): Promise<UpdateStatus>
  checkForUpdates(): Promise<void>
  /** Quits, installs the downloaded update and restarts; does nothing until one is ready. */
  installUpdate(): Promise<void>
  /** Opens the plugin bundled with the app in Stream Deck, which installs it. */
  installPluginUpdate(): Promise<void>
  onLibraryChanged(cb: (library: Library) => void): () => void
  /** `cb` returns whether the sound could be played. */
  onPlay(cb: (id: string) => boolean): () => void
  onStopAll(cb: () => void): () => void
  onStreamDeckStatus(cb: (status: StreamDeckStatus) => void): () => void
  onUpdateStatus(cb: (status: UpdateStatus) => void): () => void
}

declare global {
  interface Window {
    fawtboard: FawtboardApi
  }
}
