import { useEffect, useEffectEvent, useReducer, useRef, useState } from 'react'
import {
  CircleArrowUp,
  FileMusic,
  Headphones,
  Plus,
  RadioTower,
  Search,
  SearchX,
  Settings as SettingsIcon,
  Square,
  TriangleAlert,
  Upload,
  X
} from 'lucide-react'
import { AudioEngine, type OutputName } from './audio/engine'
import Logo from './components/Logo'
import SettingsDialog, { type SettingsTab } from './components/SettingsDialog'
import SoundEditor from './components/SoundEditor'
import SoundPad from './components/SoundPad'
import Toasts from './components/Toasts'
import { useToasts } from './hooks/useToasts'
import { accentHue } from './lib/accents'
import {
  AUDIO_EXTENSIONS,
  type AddResult,
  type Library,
  type Sound,
  type StreamDeckStatus,
  type UpdateStatus
} from '../../shared/types'

// One engine for the renderer's lifetime; the window is hidden, never destroyed.
const engine = new AudioEngine()

const OUTPUT_NAMES: OutputName[] = ['monitor', 'broadcast']
const FORMATS = AUDIO_EXTENSIONS.map((ext) => ext.toUpperCase()).join(', ')

function App(): React.JSX.Element {
  const api = window.fawtboard
  const [library, setLibrary] = useState<Library | null>(null)
  const [streamDeck, setStreamDeck] = useState<StreamDeckStatus | null>(null)
  const [update, setUpdate] = useState<UpdateStatus | null>(null)
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  /** The open Settings section, or null while Settings is closed. */
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null)
  /** Ids added a moment ago: scrolled into view and flashed so they're easy to find. */
  const [recent, setRecent] = useState<string[]>([])
  const [fileDrag, setFileDrag] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  /** Order shown while a pad is being dragged; committed to the library on drop. */
  const [dragOrder, setDragOrder] = useState<string[] | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const { toasts, notify, dismiss } = useToasts()

  useEffect(() => {
    const apply = (lib: Library): void => {
      setLibrary(lib)
      void engine.sync(lib)
    }
    let disposed = false
    void api.getLibrary().then((lib) => {
      if (!disposed) apply(lib)
    })
    void api.getStreamDeckStatus().then((status) => {
      if (!disposed) setStreamDeck(status)
    })
    void api.getUpdateStatus().then((status) => {
      if (!disposed) setUpdate(status)
    })
    engine.addEventListener('change', rerender)
    const unsubscribers = [
      api.onLibraryChanged(apply),
      api.onPlay((id) => engine.play(id)),
      api.onStopAll(() => engine.stopAll()),
      api.onStreamDeckStatus(setStreamDeck),
      api.onUpdateStatus(setUpdate)
    ]
    return () => {
      disposed = true
      engine.removeEventListener('change', rerender)
      unsubscribers.forEach((off) => off())
    }
  }, [api])

  const report = ({ added, skipped }: AddResult): void => {
    if (added.length === 0 && skipped === 0) return
    if (added.length === 0) {
      notify({ tone: 'error', message: `Nothing added. fawtboard plays ${FORMATS} files.` })
      return
    }
    const what = added.length === 1 ? `“${added[0].name}”` : `${added.length} sounds`
    const rest =
      skipped > 0 ? ` Skipped ${skipped} unsupported ${skipped === 1 ? 'file' : 'files'}.` : ''
    notify({ message: `Added ${what}.${rest}` })
    setQuery('')
    const ids = added.map((s) => s.id)
    setRecent(ids)
    setTimeout(() => setRecent((current) => (current === ids ? [] : current)), 2000)
  }

  const addFromPicker = async (): Promise<void> => report(await api.addFiles())

  const onFilesDropped = useEffectEvent(async (files: File[]) => {
    report(await api.addDroppedFiles(files))
  })

  // Files can be dropped anywhere in the window, including on top of an open dialog.
  useEffect(() => {
    let depth = 0
    const carriesFiles = (e: DragEvent): boolean => e.dataTransfer?.types.includes('Files') ?? false
    const onEnter = (e: DragEvent): void => {
      if (!carriesFiles(e)) return
      depth++
      setFileDrag(true)
    }
    const onLeave = (e: DragEvent): void => {
      if (!carriesFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setFileDrag(false)
    }
    const onOver = (e: DragEvent): void => {
      if (!carriesFiles(e) || !e.dataTransfer) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
    const onDrop = (e: DragEvent): void => {
      if (!carriesFiles(e) || !e.dataTransfer) return
      e.preventDefault()
      depth = 0
      setFileDrag(false)
      void onFilesDropped([...e.dataTransfer.files])
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('dragover', onOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    // The editor and Settings are modal and handle their own keys.
    if (editingId || settingsTab) return
    const typing = e.target instanceof HTMLInputElement && e.target.type !== 'range'
    const mod = e.ctrlKey || e.metaKey
    const key = e.key.toLowerCase()
    if ((mod && key === 'f') || (key === '/' && !typing)) {
      e.preventDefault()
      searchRef.current?.focus()
      searchRef.current?.select()
    } else if (mod && key === 'o') {
      e.preventDefault()
      void addFromPicker()
    } else if (mod && key === ',') {
      e.preventDefault()
      setSettingsTab('audio')
    } else if (key === 'escape' && !typing) {
      engine.stopAll()
    }
  })

  useEffect(() => {
    const listener = (e: KeyboardEvent): void => onKeyDown(e)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  const lastRecent = recent.at(-1)
  useEffect(() => {
    if (!lastRecent) return
    document
      .querySelector(`[data-sound-id="${lastRecent}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [lastRecent])

  const accent = library?.settings.accent
  useEffect(() => {
    if (accent === undefined) return
    document.documentElement.style.setProperty('--accent-h', String(accentHue(accent)))
  }, [accent])

  if (!library) return <div className="app" />
  const { audio, sounds } = library

  const ordered = dragOrder
    ? dragOrder.flatMap((id) => sounds.find((s) => s.id === id) ?? [])
    : sounds
  const needle = query.trim().toLowerCase()
  const visible = needle ? ordered.filter((s) => s.name.toLowerCase().includes(needle)) : ordered
  const editing = sounds.find((s) => s.id === editingId)
  const playingCount = engine.playingCount
  const routes = OUTPUT_NAMES.map((name) => engine.route(name).kind)
  const silent = engine.outputsReady && routes.every((kind) => kind === 'off' || kind === 'missing')

  /** Shows the new order at once; the library echo that follows confirms it. */
  const commitOrder = (ids: string[]): void => {
    setLibrary({ ...library, sounds: ids.flatMap((id) => sounds.find((s) => s.id === id) ?? []) })
    void api.reorderSounds(ids)
  }

  const moveBy = (id: string, delta: -1 | 1): void => {
    const ids = sounds.map((s) => s.id)
    const from = ids.indexOf(id)
    const to = from + delta
    if (to < 0 || to >= ids.length) return
    ids.splice(from, 1)
    ids.splice(to, 0, id)
    commitOrder(ids)
  }

  const dragOver = (targetId: string): void => {
    if (!dragId || dragId === targetId) return
    const ids = dragOrder ?? sounds.map((s) => s.id)
    const next = ids.filter((id) => id !== dragId)
    next.splice(ids.indexOf(targetId), 0, dragId)
    setDragOrder(next)
  }

  const endDrag = (): void => {
    setDragId(null)
    setDragOrder(null)
  }

  const remove = (sound: Sound): void => {
    const index = sounds.indexOf(sound)
    setEditingId(null)
    void api.removeSound(sound.id)
    notify({
      message: `Removed “${sound.name}”.`,
      action: { label: 'Undo', run: () => void api.restoreSound(sound, index) }
    })
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Logo />
          <span>fawtboard</span>
        </div>
        <label className="search">
          <Search size={15} aria-hidden />
          <input
            ref={searchRef}
            type="text"
            role="searchbox"
            placeholder="Search sounds"
            aria-label="Search sounds"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Escape') return
              setQuery('')
              e.currentTarget.blur()
            }}
          />
          {query ? (
            <button className="icon-btn" aria-label="Clear search" onClick={() => setQuery('')}>
              <X size={14} aria-hidden />
            </button>
          ) : (
            <kbd>/</kbd>
          )}
        </label>
        <div className="topbar-actions">
          <button
            className="btn btn-stop"
            disabled={playingCount === 0}
            title="Stop every playing sound"
            onClick={() => engine.stopAll()}
          >
            <Square size={13} aria-hidden />
            Stop all
            <kbd>Esc</kbd>
          </button>
          <button
            className="btn btn-primary"
            title="Add audio files (Ctrl/⌘+O)"
            onClick={() => void addFromPicker()}
          >
            <Plus size={16} aria-hidden />
            Add sounds
          </button>
          <button
            className="btn btn-icon"
            aria-label="Settings"
            title="Settings (Ctrl/⌘+,)"
            onClick={() => setSettingsTab('audio')}
          >
            <SettingsIcon size={17} aria-hidden />
          </button>
        </div>
      </header>

      {silent && (
        <p className="notice" role="status">
          <TriangleAlert size={15} aria-hidden />
          Sounds are silent right now: neither output has a connected device.
          <button className="btn btn-small" onClick={() => setSettingsTab('audio')}>
            Audio settings
          </button>
        </p>
      )}

      <main className="board">
        {sounds.length === 0 ? (
          <div className="empty empty-drop">
            <span className="empty-icon">
              <FileMusic size={28} aria-hidden />
            </span>
            <h2>Your board is empty</h2>
            <p>Drop audio files anywhere in this window, or pick them from your computer.</p>
            <button className="btn btn-primary" onClick={() => void addFromPicker()}>
              <Plus size={16} aria-hidden />
              Add sounds
            </button>
            <p className="empty-formats">{FORMATS}</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="empty">
            <span className="empty-icon">
              <SearchX size={28} aria-hidden />
            </span>
            <h2>No sounds match “{query.trim()}”</h2>
            <button className="btn" onClick={() => setQuery('')}>
              Clear search
            </button>
          </div>
        ) : (
          <div
            className="pads"
            onDragOver={(e) => {
              if (!dragId) return
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
            }}
            onDrop={(e) => {
              if (!dragId) return
              e.preventDefault()
              if (dragOrder) commitOrder(dragOrder)
              endDrag()
            }}
            onDragEnd={endDrag}
          >
            {visible.map((sound) => (
              <SoundPad
                key={sound.id}
                sound={sound}
                state={engine.state(sound.id)}
                error={engine.errors.get(sound.id)}
                playing={engine.isPlaying(sound.id)}
                playCount={engine.playCount(sound.id)}
                duration={engine.duration(sound.id)}
                reorderable={!needle}
                dragging={dragId === sound.id}
                recent={recent.includes(sound.id)}
                onPlay={() => engine.play(sound.id)}
                onStop={() => engine.stop(sound.id)}
                onEdit={() => setEditingId(sound.id)}
                onMove={(delta) => moveBy(sound.id, delta)}
                onDragStart={() => setDragId(sound.id)}
                onDragOver={() => dragOver(sound.id)}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="statusbar">
        <span>
          {sounds.length} {sounds.length === 1 ? 'sound' : 'sounds'}
          {needle && ` · ${visible.length} shown`}
          {playingCount > 0 && ` · ${playingCount} playing`}
        </span>
        <div className="statusbar-end">
          <button
            className="status-btn"
            aria-label="Audio settings"
            title="Where sounds are going: what you hear, then what others hear. Click to change."
            onClick={() => setSettingsTab('audio')}
          >
            {OUTPUT_NAMES.map((name, i) => {
              const Icon = name === 'monitor' ? Headphones : RadioTower
              return (
                <span
                  key={name}
                  className="status-out"
                  data-warning={engine.outputsReady && routes[i] === 'missing'}
                >
                  <Icon size={13} aria-hidden />
                  <span>{audio[name]?.label ?? 'Off'}</span>
                </span>
              )
            })}
          </button>
          {streamDeck?.state === 'unavailable' ? (
            <div
              className="status status-warning"
              title={`Stream Deck control is off: another program is using port ${streamDeck.port}. Quit it and restart fawtboard.`}
            >
              <i />
              <span>Stream Deck control is off: port {streamDeck.port} is in use</span>
            </div>
          ) : streamDeck?.state === 'listening' ? (
            <div
              className={streamDeck.clients > 0 ? 'status status-ok' : 'status'}
              title={streamDeck.clients > 0 ? 'Stream Deck connected' : 'Stream Deck not connected'}
            >
              <i />
              <span>
                {streamDeck.clients > 0 ? 'Stream Deck connected' : 'Stream Deck not connected'}
              </span>
            </div>
          ) : null}
          {(update?.state === 'ready' || update?.pluginUpdate) && (
            <button
              className="status-btn status-update"
              aria-label="Updates"
              title={
                update.state === 'ready'
                  ? `fawtboard ${update.available} is ready to install`
                  : 'A Stream Deck plugin update is ready to install'
              }
              onClick={() => setSettingsTab('updates')}
            >
              <CircleArrowUp size={14} aria-hidden />
            </button>
          )}
        </div>
      </footer>

      {fileDrag && (
        <div className="drop-overlay">
          <div className="drop-card">
            <Upload size={28} aria-hidden />
            <strong>Drop to add sounds</strong>
            <span>{FORMATS}</span>
          </div>
        </div>
      )}

      {editing && (
        <SoundEditor
          key={editing.id}
          sound={editing}
          engine={engine}
          onClose={() => setEditingId(null)}
          onRemove={() => remove(editing)}
        />
      )}

      {settingsTab && (
        <SettingsDialog
          tab={settingsTab}
          library={library}
          update={update}
          engine={engine}
          onTab={setSettingsTab}
          onClose={() => setSettingsTab(null)}
        />
      )}

      <Toasts toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}

export default App
