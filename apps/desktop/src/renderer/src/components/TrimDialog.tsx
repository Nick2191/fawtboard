import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { LoaderCircle, Play, Square, TriangleAlert, X } from 'lucide-react'
import { errorMessage, type AudioEngine } from '../audio/engine'
import type { Sound } from '../../../shared/types'
import { PAD_COLORS, padColor } from '../lib/colors'
import { formatDuration, formatTimestamp } from '../lib/format'
import { encodeWav } from '../lib/wav'
import Modal from './Modal'

type Props = {
  sound: Sound
  engine: AudioEngine
  /** e.g. "2 of 5" while working through a batch of added sounds; omitted for one sound. */
  progress?: string
  /** Shows "Skip all" when set. */
  onSkipAll?(): void
  /** Fires however the dialog closes except Skip all. */
  onDone(): void
}

type Handle = 'start' | 'end'

const PEAK_BUCKETS = 1000
/** Seconds within which a handle counts as sitting at the very start or end. */
const EDGE = 0.0005

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi)
}

/** Loudest sample of each bucket across all channels, 0–1. */
function computePeaks(buffer: AudioBuffer): Float32Array {
  const peaks = new Float32Array(PEAK_BUCKETS)
  const size = Math.max(1, Math.ceil(buffer.length / PEAK_BUCKETS))
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < data.length; i++) {
      const b = Math.floor(i / size)
      const v = Math.abs(data[i])
      if (v > peaks[b]) peaks[b] = v
    }
  }
  return peaks
}

/** Picks the kept part of a sound. Saving writes a trimmed copy; the original file is never changed. */
export default function TrimDialog({
  sound,
  engine,
  progress,
  onSkipAll,
  onDone
}: Props): React.JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null)
  const wave = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const skipAll = useRef(false)
  const dragging = useRef<Handle | null>(null)
  const stopPreviewRef = useRef<(() => void) | null>(null)
  const api = window.fawtboard

  const [source, setSource] = useState<{ buffer: AudioBuffer; path: string } | null>(null)
  const [originalGone, setOriginalGone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState({ start: 0, end: 0 })
  const [previewing, setPreviewing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const duration = source?.buffer.duration ?? 0
  const min = Math.min(0.05, duration)
  const { start, end } = range

  useEffect(() => {
    let disposed = false
    void (async () => {
      try {
        const { bytes, path, range: saved } = await api.readTrimSource(sound.id)
        const buffer = await engine.decode(bytes)
        if (disposed) return
        const length = buffer.duration
        const savedEnd = Math.min(saved?.end ?? length, length)
        setSource({ buffer, path })
        setRange({
          start: clamp(saved?.start ?? 0, 0, savedEnd - Math.min(0.05, length)),
          end: savedEnd
        })
        setOriginalGone(!!sound.trim && saved === null)
      } catch (err) {
        if (!disposed) setError(errorMessage(err))
      }
    })()
    return () => {
      disposed = true
    }
    // Loaded once per dialog: App keys it by sound id, and a save closes it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(
    () => () => {
      const stop = stopPreviewRef.current
      stopPreviewRef.current = null
      stop?.()
    },
    []
  )

  const peaks = useMemo(() => (source ? computePeaks(source.buffer) : null), [source])

  useEffect(() => {
    const el = canvas.current
    const wrapper = wave.current
    if (!el || !wrapper || !peaks) return
    const draw = (): void => {
      const ratio = window.devicePixelRatio
      el.width = Math.round(el.clientWidth * ratio)
      el.height = Math.round(el.clientHeight * ratio)
      const g = el.getContext('2d')
      if (!g) return
      g.fillStyle = getComputedStyle(el).color
      const barWidth = el.width / peaks.length
      peaks.forEach((peak, i) => {
        const h = Math.max(1, peak * el.height)
        g.fillRect(i * barWidth, (el.height - h) / 2, Math.max(1, barWidth), h)
      })
    }
    const observer = new ResizeObserver(draw)
    observer.observe(wrapper)
    return () => observer.disconnect()
  }, [peaks])

  const stopPreview = (): void => {
    const stop = stopPreviewRef.current
    stopPreviewRef.current = null
    stop?.()
    setPreviewing(false)
  }

  const startPreview = (): void => {
    if (!source) return
    stopPreview()
    const stop = engine.preview(source.buffer, start, end, sound.volume, () => {
      if (stopPreviewRef.current !== stop) return
      stopPreviewRef.current = null
      setPreviewing(false)
    })
    stopPreviewRef.current = stop
    setPreviewing(true)
  }

  const move = (handle: Handle, t: number): void => {
    stopPreview()
    setRange((r) =>
      handle === 'start'
        ? { ...r, start: clamp(t, 0, r.end - min) }
        : { ...r, end: clamp(t, r.start + min, duration) }
    )
  }

  const timeAt = (clientX: number): number => {
    const rect = wave.current!.getBoundingClientRect()
    return clamp((clientX - rect.left) / rect.width, 0, 1) * duration
  }

  const save = async (): Promise<void> => {
    if (!source) return
    stopPreview()
    const full = start <= EDGE && end >= duration - EDGE
    if (full && !sound.trim) {
      dialog.current?.close()
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      await api.saveTrim(
        sound.id,
        { source: source.path, start, end },
        full ? null : encodeWav(source.buffer, start, end)
      )
      dialog.current?.close()
    } catch (err) {
      setSaveError(`Couldn’t save the trimmed copy: ${errorMessage(err)}`)
      setSaving(false)
    }
  }

  const handle = (which: Handle): React.JSX.Element => {
    const value = which === 'start' ? start : end
    return (
      <div
        className="trim-handle"
        role="slider"
        tabIndex={0}
        aria-label={which === 'start' ? 'Start' : 'End'}
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={value}
        aria-valuetext={formatTimestamp(value)}
        style={{ left: `${(value / duration) * 100}%` }}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 0.1 : 0.01
          const next =
            e.key === 'ArrowLeft'
              ? value - step
              : e.key === 'ArrowRight'
                ? value + step
                : e.key === 'Home'
                  ? 0
                  : e.key === 'End'
                    ? duration
                    : null
          if (next === null) return
          e.preventDefault()
          move(which, next)
        }}
      />
    )
  }

  return (
    <Modal
      dialogRef={dialog}
      className="editor trimmer"
      labelledBy="trim-title"
      style={{ '--pad': PAD_COLORS[padColor(sound)] } as CSSProperties}
      onClose={() => (skipAll.current ? onSkipAll?.() : onDone())}
    >
      <div className="editor-body">
        <header className="editor-head">
          <span className="editor-swatch" aria-hidden />
          <h2 id="trim-title">Trim “{sound.name}”</h2>
          {progress && <span className="field-hint">{progress}</span>}
          <button className="icon-btn" aria-label="Close" onClick={() => dialog.current?.close()}>
            <X size={16} aria-hidden />
          </button>
        </header>

        {error ? (
          <div className="callout" role="alert">
            <TriangleAlert size={16} aria-hidden />
            <div>
              <strong>This sound can’t be trimmed.</strong>
              <p>{error}</p>
            </div>
          </div>
        ) : (
          <div className="field">
            <div
              ref={wave}
              className="trim-wave"
              onPointerDown={(e) => {
                if (!source || e.button !== 0) return
                const t = timeAt(e.clientX)
                const toStart = Math.abs(t - start)
                const toEnd = Math.abs(t - end)
                const which: Handle =
                  toStart < toEnd ? 'start' : toEnd < toStart ? 'end' : t < start ? 'start' : 'end'
                dragging.current = which
                e.currentTarget.setPointerCapture(e.pointerId)
                move(which, t)
              }}
              onPointerMove={(e) => {
                if (dragging.current) move(dragging.current, timeAt(e.clientX))
              }}
              onPointerUp={() => {
                dragging.current = null
              }}
              onPointerCancel={() => {
                dragging.current = null
              }}
            >
              {source ? (
                <>
                  <canvas ref={canvas} aria-hidden />
                  <div
                    className="trim-shade"
                    style={{ left: 0, width: `${(start / duration) * 100}%` }}
                  />
                  <div
                    className="trim-shade"
                    style={{ left: `${(end / duration) * 100}%`, right: 0 }}
                  />
                  {handle('start')}
                  {handle('end')}
                </>
              ) : (
                <div className="trim-loading">
                  <LoaderCircle size={14} className="spin" aria-hidden /> Loading…
                </div>
              )}
            </div>
            {source && (
              <div className="field-row">
                <span className="trim-readout">
                  {formatTimestamp(start)} – {formatTimestamp(end)} · {formatDuration(end - start)}
                </span>
                <button
                  className="btn btn-small"
                  onClick={() => (previewing ? stopPreview() : startPreview())}
                >
                  {previewing ? <Square size={12} aria-hidden /> : <Play size={12} aria-hidden />}
                  {previewing ? 'Stop' : 'Preview'}
                </button>
              </div>
            )}
            {originalGone && sound.trim && (
              <p className="field-hint">
                The original file ({sound.trim.source}) is gone, so this trims the current copy.
              </p>
            )}
            {saveError && (
              <p className="field-error" role="alert">
                {saveError}
              </p>
            )}
          </div>
        )}

        <footer className="editor-foot">
          {onSkipAll && (
            <button
              className="btn"
              onClick={() => {
                skipAll.current = true
                dialog.current?.close()
              }}
            >
              Skip all
            </button>
          )}
          <div className="trim-actions">
            <button className="btn" onClick={() => dialog.current?.close()}>
              {sound.trim ? 'Cancel' : 'Keep full length'}
            </button>
            <button
              className="btn btn-primary"
              disabled={!source || saving}
              onClick={() => void save()}
            >
              Save
            </button>
          </div>
        </footer>
      </div>
    </Modal>
  )
}
