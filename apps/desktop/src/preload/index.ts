import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import type {
  AddResult,
  AudioConfig,
  Library,
  Settings,
  Sound,
  SoundPatch,
  StreamDeckStatus
} from '../shared/types'

function subscribe<A extends unknown[]>(channel: string, cb: (...args: A) => void): () => void {
  const listener = (_e: IpcRendererEvent, ...args: unknown[]): void => cb(...(args as A))
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

const fawtboard = {
  getLibrary: (): Promise<Library> => ipcRenderer.invoke('library:get'),
  addFiles: (): Promise<AddResult> => ipcRenderer.invoke('library:addFiles'),
  // Dropped File objects only reveal their path on this side of the bridge.
  addDroppedFiles: (files: File[]): Promise<AddResult> =>
    ipcRenderer.invoke(
      'library:addPaths',
      files.map((file) => webUtils.getPathForFile(file))
    ),
  updateSound: (id: string, patch: SoundPatch): Promise<void> =>
    ipcRenderer.invoke('library:updateSound', id, patch),
  relinkSound: (id: string): Promise<boolean> => ipcRenderer.invoke('library:relinkSound', id),
  removeSound: (id: string): Promise<void> => ipcRenderer.invoke('library:removeSound', id),
  restoreSound: (sound: Sound, index: number): Promise<void> =>
    ipcRenderer.invoke('library:restoreSound', sound, index),
  reorderSounds: (ids: string[]): Promise<void> => ipcRenderer.invoke('library:reorder', ids),
  setAudio: (patch: Partial<AudioConfig>): Promise<void> =>
    ipcRenderer.invoke('library:setAudio', patch),
  setSettings: (patch: Partial<Settings>): Promise<void> =>
    ipcRenderer.invoke('settings:set', patch),
  chooseAddFolder: (): Promise<boolean> => ipcRenderer.invoke('settings:chooseAddFolder'),
  readSound: (id: string): Promise<ArrayBuffer> => ipcRenderer.invoke('sound:read', id),
  revealSound: (id: string): Promise<void> => ipcRenderer.invoke('sound:reveal', id),
  getStreamDeckStatus: (): Promise<StreamDeckStatus> => ipcRenderer.invoke('streamDeck:status'),
  onLibraryChanged: (cb: (library: Library) => void): (() => void) =>
    subscribe('library:changed', cb),
  onPlay: (cb: (id: string) => void): (() => void) => subscribe('engine:play', cb),
  onStopAll: (cb: () => void): (() => void) => subscribe('engine:stopAll', cb),
  onStreamDeckStatus: (cb: (status: StreamDeckStatus) => void): (() => void) =>
    subscribe('streamDeck:status', cb)
}

contextBridge.exposeInMainWorld('fawtboard', fawtboard)
