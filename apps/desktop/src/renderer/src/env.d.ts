/// <reference types="vite/client" />

// Chromium 110+ supports routing an AudioContext to a specific output; lib.dom lacks it.
interface AudioContext {
  readonly sinkId: string | { type: 'none' }
  setSinkId(sinkId: string | { type: 'none' }): Promise<void>
}
