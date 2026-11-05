import type { PlayMode, Sound } from '../../../shared/types'

type Props = {
  sound: Sound
  error: string | undefined
  onPlay(): void
}

export default function SoundCard({ sound, error, onPlay }: Props): React.JSX.Element {
  const update = window.fawtboard.updateSound

  return (
    <div className="sound-card">
      <button
        className={error ? 'play error' : 'play'}
        disabled={!!error}
        title={error ?? sound.filePath}
        onClick={onPlay}
      >
        {sound.name}
      </button>
      {error && <div className="error-text">{error}</div>}
      <input
        type="text"
        key={sound.name}
        defaultValue={sound.name}
        aria-label="Name"
        onBlur={(e) => {
          const name = e.target.value.trim()
          if (name && name !== sound.name) void update(sound.id, { name })
          else e.target.value = sound.name
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
      />
      <div className="row">
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          defaultValue={sound.volume}
          aria-label="Volume"
          onChange={(e) => void update(sound.id, { volume: e.target.valueAsNumber })}
        />
        <select
          value={sound.mode}
          aria-label="Play mode"
          onChange={(e) => void update(sound.id, { mode: e.target.value as PlayMode })}
        >
          <option value="restart">restart</option>
          <option value="overlap">overlap</option>
          <option value="toggle">toggle</option>
        </select>
        <button onClick={() => void window.fawtboard.removeSound(sound.id)}>Remove</button>
      </div>
    </div>
  )
}
