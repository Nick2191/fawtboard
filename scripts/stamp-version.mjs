#!/usr/bin/env node
// Sets the release versions from git history before a build, so each commit on main gets a
// higher version than the one before it without anyone bumping it by hand:
//   app:    <major>.<minor> from apps/desktop/package.json, patch = commits on HEAD
//   plugin: <major>.<minor> from the manifest, patch = commits touching the plugin or protocol
// The plugin's number only moves when the plugin changes, so the app doesn't ask to reinstall
// an identical plugin on every release. Needs full history (actions/checkout fetch-depth: 0).
import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const appPackage = join(root, 'apps/desktop/package.json')
const pluginManifest = join(root, 'apps/streamdeck-plugin/com.nick2191.fawtboard.sdPlugin/manifest.json')

const commits = (...paths) =>
  execFileSync('git', ['rev-list', '--count', 'HEAD', '--', ...paths], { cwd: root, encoding: 'utf8' }).trim()

const pkg = JSON.parse(readFileSync(appPackage, 'utf8'))
const [appMajor, appMinor] = pkg.version.split('.')
pkg.version = `${appMajor}.${appMinor}.${commits()}`
writeFileSync(appPackage, `${JSON.stringify(pkg, null, 2)}\n`)

// Tab-indented, like the file in the repo.
const manifest = JSON.parse(readFileSync(pluginManifest, 'utf8'))
const [pluginMajor, pluginMinor] = manifest.Version.split('.')
manifest.Version = `${pluginMajor}.${pluginMinor}.${commits('apps/streamdeck-plugin', 'packages/protocol')}.0`
writeFileSync(pluginManifest, `${JSON.stringify(manifest, null, '\t')}\n`)

console.log(`app ${pkg.version}, plugin ${manifest.Version}`)
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `app=${pkg.version}\n`)
