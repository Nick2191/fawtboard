import { WebSocket, WebSocketServer } from 'ws'
import type { AppToPlugin, PluginToApp, SoundSummary } from '@fawtboard/protocol'
import type { Library, StreamDeckStatus } from '../shared/types'
import type { LibraryStore } from './library'

// The Stream Deck plugin dials this port. FAWTBOARD_PORT lets a development copy run beside an
// installed one; the plugin itself always uses the default.
const FAWTBOARD_PORT = Number(process.env['FAWTBOARD_PORT']) || 39217

function summarize(library: Library): SoundSummary[] {
  return library.sounds.map(({ id, name, image }) => ({
    id,
    name,
    ...(image ? { imageId: image } : {})
  }))
}

function send(ws: WebSocket, msg: AppToPlugin): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
}

type Handlers = {
  /** Resolves false when the sound is gone or can't be played. */
  play(soundId: string): Promise<boolean>
  stopAll(): void
  /** A sound's image as a PNG data URL, or null when it has none. */
  readImage(soundId: string): Promise<string | null>
  onStatus(status: StreamDeckStatus): void
  /** A plugin connected; `version` is null for plugins built before they sent one. */
  onPluginVersion(version: string | null): void
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

  wss.on('connection', (ws, req) => {
    report()
    // The plugin dials `/?version=<its manifest Version>`; see @fawtboard/protocol.
    handlers.onPluginVersion(new URL(req.url ?? '/', 'ws://localhost').searchParams.get('version'))
    ws.on('close', report)
    ws.on('message', (data) => {
      let msg: PluginToApp
      try {
        msg = JSON.parse(String(data)) as PluginToApp
      } catch {
        return
      }
      switch (msg?.type) {
        case 'listSounds':
          send(ws, { type: 'sounds', requestId: msg.requestId, sounds: summarize(store.get()) })
          break
        case 'play': {
          const { soundId, requestId } = msg
          if (typeof soundId !== 'string') break
          void handlers.play(soundId).then((ok) => {
            if (typeof requestId === 'string') send(ws, { type: 'playResult', requestId, ok })
          })
          break
        }
        case 'stopAll':
          handlers.stopAll()
          break
        case 'getImage': {
          const { soundId, requestId } = msg
          if (typeof soundId !== 'string' || typeof requestId !== 'string') break
          void handlers
            .readImage(soundId)
            .then((image) => send(ws, { type: 'image', requestId, image }))
          break
        }
      }
    })
  })

  // Most library changes (a volume drag, a setting) leave what the plugin sees untouched.
  let lastPayload = ''
  store.on('changed', (library) => {
    const push: AppToPlugin = { type: 'soundsChanged', sounds: summarize(library) }
    const payload = JSON.stringify(push)
    if (payload === lastPayload) return
    lastPayload = payload
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(payload)
    }
  })

  return status
}
