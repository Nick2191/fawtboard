import { useState, type CSSProperties } from 'react'
import { Volume1, Volume2, VolumeX } from 'lucide-react'

type Props = {
  /** Initial value, 0–1. The slider owns the value while mounted so dragging never waits on IPC. */
  value: number
  label: string
  onChange(value: number): void
}

export default function Slider({ value, label, onChange }: Props): React.JSX.Element {
  const [current, setCurrent] = useState(value)
  const set = (next: number): void => {
    setCurrent(next)
    onChange(next)
  }
  const percent = Math.round(current * 100)
  const Icon = percent === 0 ? VolumeX : percent < 50 ? Volume1 : Volume2

  return (
    <div className="slider">
      <Icon size={16} aria-hidden />
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={current}
        aria-label={label}
        title="Double-click to reset to 100%"
        style={{ '--value': current } as CSSProperties}
        onChange={(e) => set(e.target.valueAsNumber)}
        onDoubleClick={() => set(1)}
      />
      <output>{percent}%</output>
    </div>
  )
}
