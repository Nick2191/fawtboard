import { EventEmitter } from 'events'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app, Notification, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateStatus } from '../shared/types'
import type { LibraryStore } from './library'

const CHECK_INTERVAL_MS = 60 * 60 * 1000
/** Shipped in the app's resources by electron-builder.yml. */
const PLUGIN_FILE = 'com.nick2191.fawtboard.streamDeckPlugin'

/** Compares dotted numeric versions ("1.0.42", "0.1.7.0"); missing parts count as 0. */
function isOlder(version: string, than: string): boolean {
  const a = version.split('.').map(Number)
  const b = than.split('.').map(Number)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] || 0) - (b[i] || 0)
    if (diff !== 0) return diff < 0
  }
  return false
}

function readMarker(file: string): string | null {
  return existsSync(file) ? readFileSync(file, 'utf8').trim() : null
}

/**
 * Keeps the app on the newest GitHub release and the Stream Deck plugin on the version bundled
 * with the app. Updates download in the background; installing is the user's call unless the
 * autoUpdate setting is on, in which case it happens on quit and at the next launch.
 */
export class Updater extends EventEmitter<{ changed: [UpdateStatus] }> {
  private status: UpdateStatus
  /** Holds the version last downloaded, so each version is announced once across restarts. */
  private readonly downloadedFile: string
  /** Holds the plugin version last offered, so a declined plugin update isn't pushed again. */
  private readonly pluginOfferedFile: string
  private readonly pluginFile: string | null

  constructor(
    private readonly store: LibraryStore,
    private readonly icon: string,
    private readonly onShow: () => void
  ) {
    super()
    const userData = app.getPath('userData')
    this.downloadedFile = join(userData, 'update-downloaded')
    this.pluginOfferedFile = join(userData, 'plugin-update-offered')
    const bundledPlugin = join(process.resourcesPath, PLUGIN_FILE)
    this.pluginFile = app.isPackaged && existsSync(bundledPlugin) ? bundledPlugin : null
    // Releases only carry the Windows installer; other builds have nothing to update from.
    const supported = app.isPackaged && process.platform === 'win32'
    this.status = { version: app.getVersion(), state: supported ? 'idle' : 'unsupported' }
    if (supported) this.start()
  }

  get(): UpdateStatus {
    return this.status
  }

  async check(): Promise<void> {
    if (this.status.state === 'unsupported') return
    // Failures arrive through the 'error' event as well.
    await autoUpdater.checkForUpdates().catch(() => {})
  }

  /** Quits, installs the downloaded update silently and starts the new version. */
  install(): void {
    if (this.status.state === 'ready') autoUpdater.quitAndInstall(true, true)
  }

  /** Opens the bundled plugin in Stream Deck, which installs it over the old one. */
  installPlugin(): void {
    if (this.pluginFile) void shell.openPath(this.pluginFile)
  }

  /** Called whenever a Stream Deck plugin connects; `version` is null for plugins too old to send it. */
  setPluginVersion(version: string | null): void {
    const bundled = __PLUGIN_VERSION__
    const outdated = this.pluginFile !== null && isOlder(version ?? '0', bundled)
    this.set({ pluginUpdate: outdated ? bundled : undefined })
    if (!outdated || readMarker(this.pluginOfferedFile) === bundled) return
    writeFileSync(this.pluginOfferedFile, bundled)
    if (this.store.get().settings.autoUpdate) this.installPlugin()
    else this.notify('Stream Deck plugin update ready', 'Open fawtboard to install it.')
  }

  private start(): void {
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = this.store.get().settings.autoUpdate
    this.store.on('changed', ({ settings }) => {
      autoUpdater.autoInstallOnAppQuit = settings.autoUpdate
    })

    // A later check can find the same or a newer release; keep offering the one already waiting.
    const setUnlessReady = (patch: Partial<UpdateStatus>): void => {
      if (this.status.state !== 'ready') this.set(patch)
    }
    autoUpdater.on('checking-for-update', () => setUnlessReady({ state: 'checking' }))
    autoUpdater.on('update-not-available', () =>
      setUnlessReady({ state: 'idle', available: undefined })
    )
    autoUpdater.on('update-available', ({ version }) =>
      setUnlessReady({ state: 'downloading', available: version })
    )
    autoUpdater.on('error', (err) => {
      console.error('Update failed:', err)
      setUnlessReady({ state: 'error' })
    })
    autoUpdater.on('update-downloaded', ({ version }) => {
      this.set({ state: 'ready', available: version })
      if (readMarker(this.downloadedFile) === version) return
      writeFileSync(this.downloadedFile, version)
      this.notify(
        `fawtboard ${version} is ready`,
        this.store.get().settings.autoUpdate
          ? 'It installs when you quit fawtboard.'
          : 'Install it from the update button whenever it suits you.'
      )
    })

    void this.checkAtLaunch()
    setInterval(() => void this.check(), CHECK_INTERVAL_MS)
  }

  /**
   * With autoUpdate on, an update downloaded in an earlier session that ended without installing
   * it (Windows shut down, the app was killed) is installed now, before the board is in use.
   */
  private async checkAtLaunch(): Promise<void> {
    const waiting = readMarker(this.downloadedFile)
    const installNow =
      this.store.get().settings.autoUpdate && waiting !== null && isOlder(app.getVersion(), waiting)
    const result = await autoUpdater.checkForUpdates().catch(() => null)
    if (!installNow || !result?.downloadPromise) return
    await result.downloadPromise.catch(() => {})
    this.install()
  }

  private notify(title: string, body: string): void {
    if (!Notification.isSupported()) return
    const notification = new Notification({ title, body, icon: this.icon })
    notification.on('click', this.onShow)
    notification.show()
  }

  private set(patch: Partial<UpdateStatus>): void {
    this.status = { ...this.status, ...patch }
    this.emit('changed', this.status)
  }
}
