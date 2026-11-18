import { readFileSync } from 'fs'
import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const pluginManifest = JSON.parse(
  readFileSync(
    resolve('../streamdeck-plugin/com.nick2191.fawtboard.sdPlugin/manifest.json'),
    'utf8'
  )
) as { Version: string }

export default defineConfig({
  main: {
    define: { __PLUGIN_VERSION__: JSON.stringify(pluginManifest.Version) }
  },
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
