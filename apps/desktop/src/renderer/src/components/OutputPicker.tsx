import type { AudioEngine, OutputName } from '../audio/engine'
import type { DeviceRef } from '../../../shared/types'

const MISSING = '__missing__'

type Props = {
  engine: AudioEngine
  name: OutputName
  label: string
  device: DeviceRef
  volume: number
  onDevice(ref: DeviceRef): void
  onVolume(volume: number): void
}

export default function OutputPicker(props: Props): React.JSX.Element {
  const { engine, name, label, device, volume } = props
  const resolved = engine.resolved(name)
  const missing = device !== null && resolved === null
  const value = resolved?.deviceId ?? (missing ? MISSING : '')

  return (
    <>
      <label htmlFor={`output-${name}`}>{label}</label>
      <select
        id={`output-${name}`}
        className={missing ? 'missing' : undefined}
        value={value}
        onChange={(e) => {
          const picked = engine.outputs.find((d) => d.deviceId === e.target.value)
          if (e.target.value === MISSING) return
          props.onDevice(picked ? { deviceId: picked.deviceId, label: picked.label } : null)
        }}
      >
        <option value="">None</option>
        {missing && <option value={MISSING}>{`${device.label} (missing)`}</option>}
        {engine.outputs.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || d.deviceId}
          </option>
        ))}
      </select>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        defaultValue={volume}
        aria-label={`${label} volume`}
        onChange={(e) => props.onVolume(e.target.valueAsNumber)}
      />
    </>
  )
}
