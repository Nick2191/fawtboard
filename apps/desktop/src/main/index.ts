import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  dialog,
  nativeTheme,
  net,
  Notification,
  protocol,
  session,
  Tray,
  Menu
} from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { existsSync, writeFileSync } from 'fs'
import { readFile } from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { SoundImages } from './images'
import { LibraryStore } from './library'
import { startWsServer } from './ws-server'
import { Updater } from './updater'
import {
  AUDIO_EXTENSIONS,
  IMAGE_SCHEME,
  type AudioConfig,
  type Settings,
  type Sound,
  type SoundPatch,
  type StreamDeckStatus,
  type UpdateStatus
} from '../shared/types'

const AUDIO_FILTERS = [{ name: 'Audio', extensions: AUDIO_EXTENSIONS }]
// What the renderer can decode into a key image; see renderer `lib/keyImage`.
const IMAGE_FILTERS = [
  { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif'] }
]

// Has to happen before the app is ready. "secure" lets the dev server's http page load it.
protocol.registerSchemesAsPrivileged([
  { scheme: IMAGE_SCHEME, privileges: { standard: true, secure: true } }
])

/** The renderer's --bg in each theme, so the window never flashes the wrong colour while loading. */
function windowBackground(): string {
  return nativeTheme.shouldUseDarkColors ? '#0f1014' : '#f4f5f7'
}

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

function showWindow(): void {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

/** Closing the window looks like quitting; the first time, say that it isn't. */
function hintTrayOnce(): void {
  const marker = join(app.getPath('userData'), 'tray-hint-shown')
  if (existsSync(marker) || !Notification.isSupported()) return
  writeFileSync(marker, '')
  new Notification({
    title: 'fawtboard is still running',
    body: 'Sounds keep working with the window closed. Use the tray icon to reopen or quit.',
    icon
  }).show()
}

/** Replaces Electron's stock menu (reload, dev tools…) with only what applies to this app. */
function createMenu(): Menu {
  const template: Electron.MenuItemConstructorOptions[] =
    process.platform === 'darwin'
      ? [{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]
      : [
          {
            label: 'File',
            submenu: [{ label: 'Quit fawtboard', accelerator: 'Ctrl+Q', click: () => app.quit() }]
          },
          { role: 'editMenu' }
        ]
  if (is.dev) template.push({ role: 'viewMenu' })
  return Menu.buildFromTemplate(template)
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 940,
    height: 700,
    minWidth: 520,
    minHeight: 420,
    show: false,
    autoHideMenuBar: true,
    title: 'fawtboard',
    backgroundColor: windowBackground(),
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      // Sounds are triggered over WebSocket, never by a user gesture in the window.
      autoplayPolicy: 'no-user-gesture-required',
      // The window spends most of its life hidden in the tray while hosting the audio engine.
      backgroundThrottling: false
    }
  })

  win.on('ready-to-show', () => win.show())

  // The renderer hosts the audio engine; hide instead of destroying it.
  win.on('close', (event) => {
    if (isQuitting) return
    event.preventDefault()
    win.hide()
    hintTrayOnce()
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return win
}

function createTray(updater: Updater): void {
  tray = new Tray(icon)
  tray.setToolTip('fawtboard')
  const buildMenu = ({ state, available, pluginUpdate }: UpdateStatus): Menu =>
    Menu.buildFromTemplate([
      { label: 'Show fawtboard', click: showWindow },
      {
        label: 'Stop all sounds',
        click: () => mainWindow?.webContents.send('engine:stopAll')
      },
      { type: 'separator' },
      ...(state === 'ready'
        ? [{ label: `Restart to update to ${available}`, click: () => updater.install() }]
        : []),
      ...(pluginUpdate
        ? [{ label: 'Update Stream Deck plugin', click: () => updater.installPlugin() }]
        : []),
      {
        label: 'Quit',
        click: () => {
          isQuitting = true
          app.quit()
        }
      }
    ])
  tray.setContextMenu(buildMenu(updater.get()))
  updater.on('changed', (status) => tray?.setContextMenu(buildMenu(status)))
  tray.on('click', showWindow)
}

function showOpenDialog(
  options: Electron.OpenDialogOptions
): Promise<Electron.OpenDialogReturnValue> {
  return mainWindow ? dialog.showOpenDialog(mainWindow, options) : dialog.showOpenDialog(options)
}

/**
 * Plays a sound in the renderer's engine and resolves with whether it could: false when the
 * sound is gone, its file is missing or undecodable, or the renderer doesn't answer.
 */
function createPlayer(win: BrowserWindow): (soundId: string) => Promise<boolean> {
  let nextRequest = 0
  const pending = new Map<number, (ok: boolean) => void>()
  ipcMain.on('engine:played', (_e, requestId: number, ok: boolean) => pending.get(requestId)?.(ok))
  return (soundId) => {
    const { promise, resolve } = Promise.withResolvers<boolean>()
    const requestId = nextRequest++
    const settle = (ok: boolean): void => {
      clearTimeout(timer)
      pending.delete(requestId)
      resolve(ok)
    }
    const timer = setTimeout(() => settle(false), 1000)
    pending.set(requestId, settle)
    win.webContents.send('engine:play', soundId, requestId)
    return promise
  }
}

function registerIpc(
  store: LibraryStore,
  images: SoundImages,
  streamDeckStatus: () => StreamDeckStatus,
  updater: Updater
): void {
  ipcMain.handle('library:get', () => store.get())
  ipcMain.handle('library:addFiles', async () => {
    const { importDir, settings } = store.get()
    // A folder that is gone (deleted, drive unplugged) is skipped; with none left the dialog
    // picks its own starting point.
    const defaultPath = [settings.addFolder, importDir].find((dir) => dir && existsSync(dir))
    const result = await showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: AUDIO_FILTERS,
      ...(defaultPath ? { defaultPath } : {})
    })
    return store.addFiles(result.canceled ? [] : result.filePaths)
  })
  ipcMain.handle('library:addPaths', (_e, paths: string[]) => store.addFiles(paths))
  ipcMain.handle('library:updateSound', (_e, id: string, patch: SoundPatch) =>
    store.updateSound(id, patch)
  )
  ipcMain.handle('library:relinkSound', async (_e, id: string) => {
    const result = await showOpenDialog({ properties: ['openFile'], filters: AUDIO_FILTERS })
    if (result.canceled || result.filePaths.length === 0) return false
    store.relinkSound(id, result.filePaths[0])
    return true
  })
  ipcMain.handle('library:removeSound', (_e, id: string) => store.removeSound(id))
  ipcMain.handle('library:restoreSound', (_e, sound: Sound, index: number) =>
    store.restoreSound(sound, index)
  )
  ipcMain.handle('library:reorder', (_e, ids: string[]) => store.reorder(ids))
  ipcMain.handle('library:setAudio', (_e, patch: Partial<AudioConfig>) => store.setAudio(patch))
  ipcMain.handle('settings:set', (_e, patch: Partial<Settings>) => store.setSettings(patch))
  ipcMain.handle('settings:chooseAddFolder', async () => {
    const current = store.get().settings.addFolder
    const result = await showOpenDialog({
      title: 'Folder to open when adding sounds',
      properties: ['openDirectory'],
      ...(current && existsSync(current) ? { defaultPath: current } : {})
    })
    if (result.canceled || result.filePaths.length === 0) return false
    store.setSettings({ addFolder: result.filePaths[0] })
    return true
  })
  ipcMain.handle('sound:read', async (_e, id: string) => {
    const sound = store.findSound(id)
    if (!sound) throw new Error(`Sound file not found: <unknown sound ${id}>`)
    let buf: Buffer
    try {
      buf = await readFile(sound.filePath)
    } catch {
      throw new Error(`Sound file not found: ${sound.filePath}`)
    }
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  })
  ipcMain.handle('sound:reveal', (_e, id: string) => {
    const sound = store.findSound(id)
    if (sound) shell.showItemInFolder(sound.filePath)
  })
  ipcMain.handle('image:pick', async () => {
    const result = await showOpenDialog({ properties: ['openFile'], filters: IMAGE_FILTERS })
    if (result.canceled || result.filePaths.length === 0) return null
    const buf = await readFile(result.filePaths[0])
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  })
  ipcMain.handle('sound:setImage', (_e, id: string, png: ArrayBuffer | null) =>
    store.setSoundImage(id, png ? images.save(new Uint8Array(png)) : undefined)
  )
  ipcMain.handle('streamDeck:status', () => streamDeckStatus())
  ipcMain.handle('update:status', () => updater.get())
  ipcMain.handle('update:check', () => updater.check())
  ipcMain.handle('update:install', () => updater.install())
  ipcMain.handle('update:installPlugin', () => updater.installPlugin())
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', showWindow)
  app.on('before-quit', () => {
    isQuitting = true
  })

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.nick2191.fawtboard')
    Menu.setApplicationMenu(createMenu())

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    // Needed for labelled enumerateDevices() results and AudioContext.setSinkId().
    const allowed = (permission: string): boolean =>
      permission === 'media' || permission === 'speaker-selection'
    session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowed(permission))
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) =>
      callback(allowed(permission))
    )

    const userData = app.getPath('userData')
    const store = new LibraryStore(join(userData, 'library.json'))
    const images = new SoundImages(join(userData, 'images'))
    images.prune(new Set(store.get().sounds.flatMap((s) => s.image ?? [])))
    protocol.handle(IMAGE_SCHEME, (request) =>
      net.fetch(pathToFileURL(images.file(decodeURIComponent(new URL(request.url).pathname))).href)
    )

    // Also drives the renderer's prefers-color-scheme, the title bar and native dialogs.
    nativeTheme.themeSource = store.get().settings.theme
    const win = createWindow()
    mainWindow = win
    nativeTheme.on('updated', () => win.setBackgroundColor(windowBackground()))
    store.on('changed', (library) => {
      if (nativeTheme.themeSource !== library.settings.theme) {
        nativeTheme.themeSource = library.settings.theme
      }
      win.webContents.send('library:changed', library)
    })
    const updater = new Updater(store, icon, showWindow)
    updater.on('changed', (status) => win.webContents.send('update:status', status))
    const streamDeckStatus = startWsServer(store, {
      play: createPlayer(win),
      stopAll: () => win.webContents.send('engine:stopAll'),
      readImage: async (soundId) => {
        const image = store.findSound(soundId)?.image
        return image ? images.dataUrl(image) : null
      },
      onStatus: (status) => win.webContents.send('streamDeck:status', status),
      onPluginVersion: (version) => updater.setPluginVersion(version)
    })
    registerIpc(store, images, streamDeckStatus, updater)
    createTray(updater)

    app.on('activate', showWindow)
  })
}
