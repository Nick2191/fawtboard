import { app, shell, BrowserWindow, ipcMain, dialog, session, Tray, Menu } from 'electron'
import { join } from 'path'
import { readFile } from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { LibraryStore } from './library'
import { startWsServer } from './ws-server'
import type { AudioConfig, SoundPatch } from '../shared/types'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

function showWindow(): void {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    title: 'fawtboard',
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

function registerIpc(store: LibraryStore): void {
  ipcMain.handle('library:get', () => store.get())
  ipcMain.handle('library:addFiles', async () => {
    const options: Electron.OpenDialogOptions = {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'flac', 'ogg', 'm4a'] }]
    }
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled) return []
    return store.addFiles(result.filePaths)
  })
  ipcMain.handle('library:updateSound', (_e, id: string, patch: SoundPatch) =>
    store.updateSound(id, patch)
  )
  ipcMain.handle('library:removeSound', (_e, id: string) => store.removeSound(id))
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
    registerIpc(store)

    const win = createWindow()
    mainWindow = win
    store.on('changed', (library) => win.webContents.send('library:changed', library))
    startWsServer(store, win)
    createTray()

    app.on('activate', showWindow)
  })
}
