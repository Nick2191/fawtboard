import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
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
  pickImage: (): Promise<ArrayBuffer | null> => ipcRenderer.invoke('image:pick'),
  setSoundImage: (id: string, png: ArrayBuffer | null): Promise<void> =>
    ipcRenderer.invoke('sound:setImage', id, png),
  getStreamDeckStatus: (): Promise<StreamDeckStatus> => ipcRenderer.invoke('streamDeck:status'),
  getUpdateStatus: (): Promise<UpdateStatus> => ipcRenderer.invoke('update:status'),
  checkForUpdates: (): Promise<void> => ipcRenderer.invoke('update:check'),
  installUpdate: (): Promise<void> => ipcRenderer.invoke('update:install'),
  installPluginUpdate: (): Promise<void> => ipcRenderer.invoke('update:installPlugin'),
  onLibraryChanged: (cb: (library: Library) => void): (() => void) =>
    subscribe('library:changed', cb),
  // The callback's answer goes back to main so a Stream Deck key can show when a play failed.
  onPlay: (cb: (id: string) => boolean): (() => void) =>
    subscribe('engine:play', (id: string, requestId: number) =>
      ipcRenderer.send('engine:played', requestId, cb(id))
    ),
  onStopAll: (cb: () => void): (() => void) => subscribe('engine:stopAll', cb),
  onStreamDeckStatus: (cb: (status: StreamDeckStatus) => void): (() => void) =>
    subscribe('streamDeck:status', cb),
  onUpdateStatus: (cb: (status: UpdateStatus) => void): (() => void) =>
    subscribe('update:status', cb)
}

contextBridge.exposeInMainWorld('fawtboard', fawtboard)
