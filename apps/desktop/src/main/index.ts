import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  dialog,
  nativeTheme,
  Notification,
  session,
  Tray,
  Menu
} from 'electron'
import { join } from 'path'
import { existsSync, writeFileSync } from 'fs'
import { readFile } from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { LibraryStore } from './library'
import { startWsServer } from './ws-server'
import {
  AUDIO_EXTENSIONS,
  type AudioConfig,
  type Sound,
  type SoundPatch,
  type StreamDeckStatus
} from '../shared/types'

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
    // Matches the renderer's --bg so the window never flashes white while loading.
    backgroundColor: '#0f1014',
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

function createTray(): void {
  tray = new Tray(icon)
  tray.setToolTip('fawtboard')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Show fawtboard', click: showWindow },
      {
        label: 'Stop all sounds',
        click: () => mainWindow?.webContents.send('engine:stopAll')
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          isQuitting = true
          app.quit()
        }
      }
    ])
  )
  tray.on('click', showWindow)
}

function showOpenDialog(
  options: Electron.OpenDialogOptions
): Promise<Electron.OpenDialogReturnValue> {
  const filtered: Electron.OpenDialogOptions = {
    ...options,
    filters: [{ name: 'Audio', extensions: AUDIO_EXTENSIONS }]
  }
  return mainWindow ? dialog.showOpenDialog(mainWindow, filtered) : dialog.showOpenDialog(filtered)
}

function registerIpc(store: LibraryStore, streamDeckStatus: () => StreamDeckStatus): void {
  ipcMain.handle('library:get', () => store.get())
  ipcMain.handle('library:addFiles', async () => {
    const { importDir } = store.get()
    const result = await showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      // Skipped when the folder is gone (deleted, drive unplugged): the dialog then picks its own.
      ...(importDir && existsSync(importDir) ? { defaultPath: importDir } : {})
    })
    return store.addFiles(result.canceled ? [] : result.filePaths)
  })
  ipcMain.handle('library:addPaths', (_e, paths: string[]) => store.addFiles(paths))
  ipcMain.handle('library:updateSound', (_e, id: string, patch: SoundPatch) =>
    store.updateSound(id, patch)
  )
  ipcMain.handle('library:relinkSound', async (_e, id: string) => {
    const result = await showOpenDialog({ properties: ['openFile'] })
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
  ipcMain.handle('streamDeck:status', () => streamDeckStatus())
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
    // The UI is dark only; this keeps the native title bar, menus and dialogs in step with it.
    nativeTheme.themeSource = 'dark'
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

    const store = new LibraryStore(join(app.getPath('userData'), 'library.json'))
    const win = createWindow()
    mainWindow = win
    store.on('changed', (library) => win.webContents.send('library:changed', library))
    const streamDeckStatus = startWsServer(store, {
      onPlay: (soundId) => win.webContents.send('engine:play', soundId),
      onStopAll: () => win.webContents.send('engine:stopAll'),
      onStatus: (status) => win.webContents.send('streamDeck:status', status)
    })
    registerIpc(store, streamDeckStatus)
    createTray()

    app.on('activate', showWindow)
  })
}
