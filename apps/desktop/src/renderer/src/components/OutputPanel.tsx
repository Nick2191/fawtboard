import { TriangleAlert, type LucideIcon } from 'lucide-react'
import type { AudioEngine, OutputName } from '../audio/engine'
import { SYSTEM_DEFAULT_DEVICE, type DeviceRef } from '../../../shared/types'
import Slider from './Slider'

const OFF = ''
const MISSING = '__missing__'

type Props = {
  engine: AudioEngine
  name: OutputName
  title: string
  hint: string
  icon: LucideIcon
  volume: number
  onDevice(ref: DeviceRef): void
  onVolume(volume: number): void
}

export default function OutputPanel(props: Props): React.JSX.Element {
  const { engine, name, title, hint, icon: Icon, volume } = props
  const route = engine.route(name)
  // Before the first enumeration every saved device looks missing; don't cry wolf.
  const unplugged = route.kind === 'missing' && engine.outputsReady
  const audible = route.kind === 'device' || route.kind === 'default'
  const value =
    route.kind === 'device'
      ? route.device.deviceId
      : route.kind === 'default'
        ? SYSTEM_DEFAULT_DEVICE.deviceId
        : route.kind === 'missing'
          ? MISSING
          : OFF

  return (
    <div className="output" data-audible={audible}>
      <div className="output-head">
        <span className="output-icon">
          <Icon size={16} aria-hidden />
        </span>
        <label htmlFor={`output-${name}`} className="output-title">
          {title}
        </label>
        <span className="output-hint">{hint}</span>
        <button
          className="btn btn-small"
          disabled={!audible}
          title="Play a short test tone on this output"
          onClick={() => engine.testTone(name)}
        >
          Test
        </button>
      </div>
      <div className="output-controls">
        <select
          id={`output-${name}`}
          className={unplugged ? 'select select-warning' : 'select'}
          value={value}
          onChange={(e) => {
            const id = e.target.value
            if (id === OFF) props.onDevice(null)
            else if (id === SYSTEM_DEFAULT_DEVICE.deviceId) props.onDevice(SYSTEM_DEFAULT_DEVICE)
            else {
              const picked = engine.outputs.find((d) => d.deviceId === id)
              if (picked) props.onDevice({ deviceId: picked.deviceId, label: picked.label })
            }
          }}
        >
          <option value={OFF}>Off</option>
          <option value={SYSTEM_DEFAULT_DEVICE.deviceId}>{SYSTEM_DEFAULT_DEVICE.label}</option>
          {route.kind === 'missing' && (
            <option value={MISSING} disabled>
              {unplugged ? `${route.label} (unplugged)` : route.label}
            </option>
          )}
          {engine.outputs.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || d.deviceId}
            </option>
          ))}
        </select>
        <Slider value={volume} label={`${title} volume`} onChange={props.onVolume} />
      </div>
      {unplugged && (
        <p className="output-warning">
          <TriangleAlert size={14} aria-hidden />
          Not connected. Sounds play here again once it’s back.
        </p>
      )}
    </div>
  )
}
