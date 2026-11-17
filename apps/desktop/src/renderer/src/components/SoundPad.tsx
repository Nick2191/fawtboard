import type { CSSProperties } from 'react'
import { Ellipsis, LoaderCircle, Square, TriangleAlert } from 'lucide-react'
import type { SoundState } from '../audio/engine'
import type { Sound } from '../../../shared/types'
import { PAD_COLORS, padColor } from '../lib/colors'
import { formatDuration } from '../lib/format'
import { soundImageUrl } from '../lib/keyImage'
import { PLAY_MODES } from '../lib/modes'

type Props = {
  sound: Sound
  state: SoundState
  error: string | undefined
  playing: boolean
  /** Changes on every (re)start so the progress bar restarts with the sound. */
  playCount: number
  duration: number | undefined
  /** False while the board is filtered: a partial list has no meaningful order to change. */
  reorderable: boolean
  dragging: boolean
  /** Just added: flashes once so it stands out on a full board. */
  recent: boolean
  onPlay(): void
  onStop(): void
  onEdit(): void
  onMove(delta: -1 | 1): void
  onDragStart(): void
  onDragOver(): void
}

export default function SoundPad(props: Props): React.JSX.Element {
  const { sound, state, error, playing, duration } = props
  const ModeIcon = PLAY_MODES[sound.mode].icon

  return (
    <div
      className="pad"
      data-sound-id={sound.id}
      data-state={state}
      data-playing={playing}
      data-dragging={props.dragging}
      data-recent={props.recent}
      data-art={sound.image !== undefined}
      style={{ '--pad': PAD_COLORS[padColor(sound)] } as CSSProperties}
      draggable={props.reorderable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('application/x-fawtboard-sound', sound.id)
        props.onDragStart()
      }}
      onDragOver={props.onDragOver}
      onContextMenu={(e) => {
        e.preventDefault()
        props.onEdit()
      }}
    >
      <button
        className="pad-trigger"
        title={error ?? sound.name}
        // A broken pad can't play, so pressing it goes straight to where it can be fixed.
        onClick={state === 'error' ? props.onEdit : props.onPlay}
        onKeyDown={(e) => {
          if (!props.reorderable || !e.altKey) return
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
          e.preventDefault()
          props.onMove(e.key === 'ArrowLeft' ? -1 : 1)
        }}
      >
        {sound.image && (
          <span
            className="pad-art"
            style={{ backgroundImage: `url("${soundImageUrl(sound.image)}")` }}
          />
        )}
        <span className="pad-name">{sound.name}</span>
        <span className="pad-meta">
          {state === 'error' ? (
            <>
              <TriangleAlert size={13} aria-hidden /> Can’t play
            </>
          ) : state === 'loading' || duration === undefined ? (
            <>
              <LoaderCircle size={13} className="spin" aria-hidden /> Loading…
            </>
          ) : (
            <>
              {playing ? (
                <span className="equalizer" aria-label="Playing">
                  <i />
                  <i />
                  <i />
                </span>
              ) : (
                <ModeIcon size={13} aria-label={`${PLAY_MODES[sound.mode].label} mode`} />
              )}
              {formatDuration(duration)}
            </>
          )}
        </span>
        {playing && duration !== undefined && (
          <span
            key={props.playCount}
            className="pad-progress"
            style={{ animationDuration: `${duration}s` }}
          />
        )}
      </button>
      {playing && (
        <button
          className="pad-action pad-stop"
          aria-label={`Stop ${sound.name}`}
          title="Stop"
          onClick={props.onStop}
        >
          <Square size={12} aria-hidden />
        </button>
      )}
      <button
        className="pad-action pad-edit"
        aria-label={`Edit ${sound.name}`}
        title="Edit (right-click)"
        onClick={props.onEdit}
      >
        <Ellipsis size={16} aria-hidden />
      </button>
    </div>
  )
}
