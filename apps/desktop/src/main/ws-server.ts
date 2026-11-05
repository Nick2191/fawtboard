import { dialog, type BrowserWindow } from 'electron'
import { WebSocket, WebSocketServer } from 'ws'
import type { AppToPlugin, PluginToApp, SoundSummary } from '@fawtboard/protocol'
import type { Library } from '../shared/types'
import type { LibraryStore } from './library'

const FAWTBOARD_PORT = 39217

function summarize(library: Library): SoundSummary[] {
  return library.sounds.map(({ id, name }) => ({ id, name }))
}

export function startWsServer(store: LibraryStore, win: BrowserWindow): WebSocketServer {
  // Browsers always send an Origin header; the Stream Deck plugin (Node) does not.
  // Rejecting any Origin keeps web pages from triggering sounds.
  const wss = new WebSocketServer({
    host: '127.0.0.1',
    port: FAWTBOARD_PORT,
    verifyClient: (info) => !info.origin
  })

  wss.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      dialog.showErrorBox(
        'fawtboard',
        `Port ${FAWTBOARD_PORT} is in use; Stream Deck control is disabled.`
      )
    } else {
      console.error('WebSocket server error:', err)
    }
  })

  wss.on('connection', (ws) => {
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
          if (typeof msg.soundId === 'string') win.webContents.send('engine:play', msg.soundId)
          break
        case 'stopAll':
          win.webContents.send('engine:stopAll')
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

  return wss
}
