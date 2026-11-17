import { useRef, type CSSProperties } from 'react'
import {
  FolderOpen,
  Headphones,
  Monitor,
  Moon,
  Palette,
  RadioTower,
  Sun,
  Volume2,
  X,
  type LucideIcon
} from 'lucide-react'
import type { AudioEngine } from '../audio/engine'
import type { Library, Theme } from '../../../shared/types'
import { ACCENTS, type Accent } from '../lib/accents'
import Modal from './Modal'
import OutputPanel from './OutputPanel'

export type SettingsTab = 'audio' | 'library' | 'appearance'

const TABS: Record<SettingsTab, { label: string; icon: LucideIcon }> = {
  audio: { label: 'Audio', icon: Volume2 },
  library: { label: 'Library', icon: FolderOpen },
  appearance: { label: 'Appearance', icon: Palette }
}

const THEME_OPTIONS: Record<Theme, { label: string; icon: LucideIcon }> = {
  system: { label: 'System', icon: Monitor },
  light: { label: 'Light', icon: Sun },
  dark: { label: 'Dark', icon: Moon }
}

type Props = {
  tab: SettingsTab
  library: Library
  engine: AudioEngine
  onTab(tab: SettingsTab): void
  onClose(): void
}

/** Every control applies immediately; there is nothing to save or cancel. */
export default function SettingsDialog(props: Props): React.JSX.Element {
  const { tab, library, engine } = props
  const { audio, settings, importDir } = library
  const dialog = useRef<HTMLDialogElement>(null)
  const api = window.fawtboard

  return (
    <Modal
      dialogRef={dialog}
      className="settings"
      labelledBy="settings-title"
      onClose={props.onClose}
    >
      <div className="settings-body">
        <nav className="settings-nav" role="tablist" aria-orientation="vertical">
          <h2 id="settings-title">Settings</h2>
          {(Object.keys(TABS) as SettingsTab[]).map((key) => {
            const { label, icon: Icon } = TABS[key]
            return (
              <button
                key={key}
                role="tab"
                id={`settings-tab-${key}`}
                className="settings-tab"
                aria-selected={key === tab}
                aria-controls="settings-panel"
                onClick={() => props.onTab(key)}
              >
                <Icon size={16} aria-hidden />
                {label}
              </button>
            )
          })}
        </nav>

        <section
          id="settings-panel"
          className="settings-panel"
          role="tabpanel"
          aria-labelledby={`settings-tab-${tab}`}
        >
          <header className="settings-head">
            <h2>{TABS[tab].label}</h2>
            <button className="icon-btn" aria-label="Close" onClick={() => dialog.current?.close()}>
              <X size={16} aria-hidden />
            </button>
          </header>

          {tab === 'audio' && (
            <div className="settings-content">
              <p className="settings-lede">
                Every sound plays to both outputs at once. Send one to your own ears and the other
                to a virtual cable that feeds your microphone in Discord, OBS and similar apps.
              </p>
              <div className="outputs">
                <OutputPanel
                  engine={engine}
                  name="monitor"
                  title="You hear"
                  hint="Your headphones or speakers"
                  icon={Headphones}
                  volume={audio.monitorVolume}
                  onDevice={(monitor) => void api.setAudio({ monitor })}
                  onVolume={(monitorVolume) => void api.setAudio({ monitorVolume })}
                />
                <OutputPanel
                  engine={engine}
                  name="broadcast"
                  title="Others hear"
                  hint="A virtual cable into Discord, OBS…"
                  icon={RadioTower}
                  volume={audio.broadcastVolume}
                  onDevice={(broadcast) => void api.setAudio({ broadcast })}
                  onVolume={(broadcastVolume) => void api.setAudio({ broadcastVolume })}
                />
              </div>
            </div>
          )}

          {tab === 'library' && (
            <div className="settings-content">
              <div className="field" role="radiogroup" aria-labelledby="settings-add-folder">
                <span className="field-label" id="settings-add-folder">
                  When adding sounds, open
                </span>
                <div className="choices">
                  <label className="choice">
                    <input
                      type="radio"
                      name="add-folder"
                      checked={settings.addFolder === null}
                      onChange={() => void api.setSettings({ addFolder: null })}
                    />
                    <span className="choice-text">
                      <span className="choice-title">The folder I last added from</span>
                      <span className="choice-detail">
                        {importDir ?? 'Nothing added yet, so the first time is up to your system.'}
                      </span>
                    </span>
                  </label>
                  <label className="choice">
                    <input
                      type="radio"
                      name="add-folder"
                      checked={settings.addFolder !== null}
                      // There is no folder to switch to yet, so choosing this option asks for one.
                      onChange={() => void api.chooseAddFolder()}
                    />
                    <span className="choice-text">
                      <span className="choice-title">Always the same folder</span>
                      <span className="choice-detail">
                        {settings.addFolder ?? 'Pick the folder where you keep your sounds.'}
                      </span>
                    </span>
                    {settings.addFolder !== null && (
                      <button className="btn btn-small" onClick={() => void api.chooseAddFolder()}>
                        Change…
                      </button>
                    )}
                  </label>
                </div>
                <p className="field-hint">
                  Sound files stay where they are. fawtboard plays them from their own folders and
                  never copies them.
                </p>
              </div>
            </div>
          )}

          {tab === 'appearance' && (
            <div className="settings-content">
              <div className="field" role="radiogroup" aria-labelledby="settings-theme">
                <span className="field-label" id="settings-theme">
                  Theme
                </span>
                <div className="segments">
                  {(Object.keys(THEME_OPTIONS) as Theme[]).map((theme) => {
                    const { label, icon: Icon } = THEME_OPTIONS[theme]
                    return (
                      <label key={theme} className="segment">
                        <input
                          type="radio"
                          name="theme"
                          checked={theme === settings.theme}
                          onChange={() => void api.setSettings({ theme })}
                        />
                        <Icon size={14} aria-hidden />
                        {label}
                      </label>
                    )
                  })}
                </div>
                <p className="field-hint">System follows your computer’s light or dark setting.</p>
              </div>

              <div className="field" role="radiogroup" aria-labelledby="settings-accent">
                <span className="field-label" id="settings-accent">
                  Accent color
                </span>
                <div className="swatches">
                  {(Object.keys(ACCENTS) as Accent[]).map((accent) => (
                    <label
                      key={accent}
                      className="swatch"
                      title={accent}
                      style={{ '--pad': `oklch(0.66 0.17 ${ACCENTS[accent]})` } as CSSProperties}
                    >
                      <input
                        type="radio"
                        name="accent"
                        aria-label={accent}
                        checked={accent === settings.accent}
                        onChange={() => void api.setSettings({ accent })}
                      />
                    </label>
                  ))}
                </div>
                <p className="field-hint">
                  Used for buttons and highlights. Each sound keeps its own color.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </Modal>
  )
}
