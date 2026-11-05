import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { AudioConfig, Library, Sound, SoundPatch } from '../shared/types'

function subscribe<A extends unknown[]>(channel: string, cb: (...args: A) => void): () => void {
  const listener = (_e: IpcRendererEvent, ...args: unknown[]): void => cb(...(args as A))
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

const fawtboard = {
  getLibrary: (): Promise<Library> => ipcRenderer.invoke('library:get'),
  addFiles: (): Promise<Sound[]> => ipcRenderer.invoke('library:addFiles'),
  updateSound: (id: string, patch: SoundPatch): Promise<void> =>
    ipcRenderer.invoke('library:updateSound', id, patch),
  removeSound: (id: string): Promise<void> => ipcRenderer.invoke('library:removeSound', id),
  setAudio: (patch: Partial<AudioConfig>): Promise<void> =>
    ipcRenderer.invoke('library:setAudio', patch),
  readSound: (id: string): Promise<ArrayBuffer> => ipcRenderer.invoke('sound:read', id),
  onLibraryChanged: (cb: (library: Library) => void): (() => void) =>
    subscribe('library:changed', cb),
  onPlay: (cb: (id: string) => void): (() => void) => subscribe('engine:play', cb),
  onStopAll: (cb: () => void): (() => void) => subscribe('engine:stopAll', cb)
}

contextBridge.exposeInMainWorld('fawtboard', fawtboard)
