import { useEffect, useReducer, useState } from 'react'
import { AudioEngine } from './audio/engine'
import OutputPicker from './components/OutputPicker'
import SoundCard from './components/SoundCard'
import type { Library } from '../../shared/types'

// One engine for the renderer's lifetime; the window is hidden, never destroyed.
const engine = new AudioEngine()

function App(): React.JSX.Element {
  const [library, setLibrary] = useState<Library | null>(null)
  const [, rerender] = useReducer((n: number) => n + 1, 0)

  useEffect(() => {
    const api = window.fawtboard
    const apply = (lib: Library): void => {
      setLibrary(lib)
      void engine.sync(lib)
    }
    let disposed = false
    void api.getLibrary().then((lib) => {
      if (!disposed) apply(lib)
    })
    engine.addEventListener('change', rerender)
    const unsubscribers = [
      api.onLibraryChanged(apply),
      api.onPlay((id) => engine.play(id)),
      api.onStopAll(() => engine.stopAll())
    ]
    return () => {
      disposed = true
      engine.removeEventListener('change', rerender)
      unsubscribers.forEach((off) => off())
    }
  }, [])

  if (!library) return <div className="empty">Loading…</div>
  const { audio, sounds } = library
  const api = window.fawtboard

  return (
    <>
      <div className="toolbar">
        <button onClick={() => void api.addFiles()}>Add sounds…</button>
        <button onClick={() => engine.stopAll()}>Stop all</button>
      </div>

      <section>
        <h2>Outputs</h2>
        <div className="outputs">
          <OutputPicker
            engine={engine}
            name="monitor"
            label="You hear (monitor)"
            device={audio.monitor}
            volume={audio.monitorVolume}
            onDevice={(monitor) => void api.setAudio({ monitor })}
            onVolume={(monitorVolume) => void api.setAudio({ monitorVolume })}
          />
          <OutputPicker
            engine={engine}
            name="broadcast"
            label="Discord (broadcast)"
            device={audio.broadcast}
            volume={audio.broadcastVolume}
            onDevice={(broadcast) => void api.setAudio({ broadcast })}
            onVolume={(broadcastVolume) => void api.setAudio({ broadcastVolume })}
          />
        </div>
      </section>

      <section>
        <h2>Sounds</h2>
        {sounds.length === 0 ? (
          <div className="empty">No sounds yet. Use “Add sounds…” to pick audio files.</div>
        ) : (
          <div className="sounds">
            {sounds.map((sound) => (
              <SoundCard
                key={sound.id}
                sound={sound}
                error={engine.errors.get(sound.id)}
                onPlay={() => engine.play(sound.id)}
              />
            ))}
          </div>
        )}
      </section>
    </>
  )
}

export default App
