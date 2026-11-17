import { WebSocket, WebSocketServer } from 'ws'
import type { AppToPlugin, PluginToApp, SoundSummary } from '@fawtboard/protocol'
import type { Library, StreamDeckStatus } from '../shared/types'
import type { LibraryStore } from './library'

// The Stream Deck plugin dials this port. FAWTBOARD_PORT lets a development copy run beside an
// installed one; the plugin itself always uses the default.
const FAWTBOARD_PORT = Number(process.env['FAWTBOARD_PORT']) || 39217

function summarize(library: Library): SoundSummary[] {
  return library.sounds.map(({ id, name }) => ({ id, name }))
}

type Handlers = {
  onPlay(soundId: string): void
  onStopAll(): void
  onStatus(status: StreamDeckStatus): void
}

/** Starts the plugin-facing server and returns a getter for its current status. */
export function startWsServer(store: LibraryStore, handlers: Handlers): () => StreamDeckStatus {
  // Browsers always send an Origin header; the Stream Deck plugin (Node) does not.
  // Rejecting any Origin keeps web pages from triggering sounds.
  const wss = new WebSocketServer({
    host: '127.0.0.1',
    port: FAWTBOARD_PORT,
    verifyClient: (info) => !info.origin
  })

  let state: StreamDeckStatus['state'] = 'starting'
  const status = (): StreamDeckStatus => ({
    state,
    clients: wss.clients.size,
    port: FAWTBOARD_PORT
  })
  const report = (): void => handlers.onStatus(status())

  wss.on('listening', () => {
    state = 'listening'
    report()
  })

  wss.on('error', (err: NodeJS.ErrnoException) => {
    console.error('WebSocket server error:', err)
    if (err.code === 'EADDRINUSE') {
      state = 'unavailable'
      report()
    }
  })

  wss.on('connection', (ws) => {
    report()
    ws.on('close', report)
    ws.on('message', (data) => {
      let msg: PluginToApp
      try {
        msg = JSON.parse(String(data)) as PluginToApp
      } catch {
        return
      }
      switch (msg?.type) {
        case 'listSounds': {
          const reply: AppToPlugin = {
            type: 'sounds',
            requestId: msg.requestId,
            sounds: summarize(store.get())
          }
          ws.send(JSON.stringify(reply))
          break
        }
        case 'play':
          if (typeof msg.soundId === 'string') handlers.onPlay(msg.soundId)
          break
        case 'stopAll':
          handlers.onStopAll()
          break
      }
    })
  })

  store.on('changed', (library) => {
    const push: AppToPlugin = { type: 'soundsChanged', sounds: summarize(library) }
    const payload = JSON.stringify(push)
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(payload)
    }
  })

  return status
}
