import { useRef, type CSSProperties } from 'react'
import { FolderOpen, Play, Replace, Square, Trash2, TriangleAlert, X } from 'lucide-react'
import type { AudioEngine } from '../audio/engine'
import type { PlayMode, Sound } from '../../../shared/types'
import { PAD_COLORS, padColor, type PadColor } from '../lib/colors'
import { PLAY_MODES } from '../lib/modes'
import Modal from './Modal'
import Slider from './Slider'

type Props = {
  sound: Sound
  engine: AudioEngine
  onClose(): void
  onRemove(): void
}

/** Every control applies immediately; there is nothing to save or cancel. */
export default function SoundEditor({
  sound,
  engine,
  onClose,
  onRemove
}: Props): React.JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null)
  const api = window.fawtboard
  const error = engine.errors.get(sound.id)
  const playing = engine.isPlaying(sound.id)
  const color = padColor(sound)

  return (
    <Modal
      dialogRef={dialog}
      className="editor"
      labelledBy="editor-title"
      style={{ '--pad': PAD_COLORS[color] } as CSSProperties}
      onClose={onClose}
    >
      <div className="editor-body">
        <header className="editor-head">
          <span className="editor-swatch" aria-hidden />
          <h2 id="editor-title">Edit sound</h2>
          <button className="icon-btn" aria-label="Close" onClick={() => dialog.current?.close()}>
            <X size={16} aria-hidden />
          </button>
        </header>

        {error && (
          <div className="callout" role="alert">
            <TriangleAlert size={16} aria-hidden />
            <div>
              <strong>This sound can’t be played.</strong>
              <p>{error}</p>
            </div>
            <button className="btn btn-small" onClick={() => engine.reload(sound.id)}>
              Try again
            </button>
          </div>
        )}

        <label className="field">
          <span className="field-label">Name</span>
          <input
            type="text"
            className="input"
            defaultValue={sound.name}
            autoFocus={!error}
            spellCheck={false}
            onChange={(e) => {
              const name = e.target.value.trim()
              if (name) void api.updateSound(sound.id, { name })
            }}
            onBlur={(e) => {
              if (!e.target.value.trim()) e.target.value = sound.name
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') dialog.current?.close()
            }}
          />
        </label>

        <div className="field" role="radiogroup" aria-labelledby="editor-color">
          <span className="field-label" id="editor-color">
            Color
          </span>
          <div className="swatches">
            {(Object.keys(PAD_COLORS) as PadColor[]).map((key) => (
              <label
                key={key}
                className="swatch"
                title={key}
                style={{ '--pad': PAD_COLORS[key] } as CSSProperties}
              >
                <input
                  type="radio"
                  name="color"
                  aria-label={key}
                  checked={key === color}
                  onChange={() => void api.updateSound(sound.id, { color: key })}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field-label">Volume</span>
          <div className="field-row">
            <Slider
              value={sound.volume}
              label="Volume"
              onChange={(volume) => void api.updateSound(sound.id, { volume })}
            />
            <button
              className="btn btn-small"
              disabled={!!error}
              onClick={() => (playing ? engine.stop(sound.id) : engine.play(sound.id))}
            >
              {playing ? <Square size={12} aria-hidden /> : <Play size={12} aria-hidden />}
              {playing ? 'Stop' : 'Preview'}
            </button>
          </div>
        </div>

        <div className="field" role="radiogroup" aria-labelledby="editor-mode">
          <span className="field-label" id="editor-mode">
            When pressed again
          </span>
          <div className="segments">
            {(Object.keys(PLAY_MODES) as PlayMode[]).map((mode) => {
              const { label, icon: Icon } = PLAY_MODES[mode]
              return (
                <label key={mode} className="segment">
                  <input
                    type="radio"
                    name="mode"
                    checked={mode === sound.mode}
                    onChange={() => void api.updateSound(sound.id, { mode })}
                  />
                  <Icon size={14} aria-hidden />
                  {label}
                </label>
              )
            })}
          </div>
          <p className="field-hint">{PLAY_MODES[sound.mode].hint}</p>
        </div>

        <div className="field">
          <span className="field-label">File</span>
          <p className="file-path" title={sound.filePath}>
            {sound.filePath}
          </p>
          <div className="field-row">
            <button className="btn btn-small" onClick={() => void api.revealSound(sound.id)}>
              <FolderOpen size={14} aria-hidden />
              Show in folder
            </button>
            <button className="btn btn-small" onClick={() => void api.relinkSound(sound.id)}>
              <Replace size={14} aria-hidden />
              Replace file…
            </button>
          </div>
        </div>

        <footer className="editor-foot">
          <button className="btn btn-danger" onClick={onRemove}>
            <Trash2 size={14} aria-hidden />
            Remove
          </button>
          <button className="btn btn-primary" onClick={() => dialog.current?.close()}>
            Done
          </button>
        </footer>
      </div>
    </Modal>
  )
}
