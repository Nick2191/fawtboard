# Set up on a new Windows machine

This gets you from a fresh Windows machine to a working fawtboard and Stream Deck plugin.

## 1. Install

You need the Elgato Stream Deck app 7.1 or newer if you use the plugin. In PowerShell:

```powershell
irm https://raw.githubusercontent.com/Nick2191/fawtboard/main/scripts/install.ps1 | iex
irm https://raw.githubusercontent.com/Nick2191/fawtboard/main/scripts/install-streamdeck-plugin.ps1 | iex
```

The first line installs the app from the latest [release](https://github.com/Nick2191/fawtboard/releases/latest) and starts it in the tray. The second hands the plugin to Stream Deck, which adds a **fawtboard** category to its action list. From `cmd` instead of PowerShell, wrap each line: `powershell -c "irm … | iex"`.

Then pick where sounds go in **Settings → Audio** (the gear button):

- **You hear**: your headphones or speakers.
- **Others hear**: a virtual audio cable, such as [VB-Audio Virtual Cable](https://vb-audio.com/Cable/) or a [Voicemeeter](https://vb-audio.com/Voicemeeter/) input. Discord, OBS and similar apps then use that cable as an input. To be heard over your own mic, mix the two first, in Voicemeeter or in your headset's mixer software, and give Discord the mixed output.

Each output has a **Test** button that plays a short tone on that device only. Discord's Noise Suppression and Automatic Gain Control treat sound effects as noise. If sounds come through quiet or cut off, turn them off in User Settings → Voice & Video.

To put a sound on a Stream Deck key, drag **fawtboard → Play Sound** onto the key and pick the sound in its **Sound** dropdown. The list comes live from the running app, and the key shows the sound's image. **Stop All Sounds** stops everything. Keys only work while fawtboard is running; closing its window leaves it running in the tray.

## 2. Updates

Every push to `main` that changes code runs [.github/workflows/release.yml](../.github/workflows/release.yml). It builds both packages on Windows and publishes them as release `v1.0.<commits on main>`. Pushes that only touch docs or Markdown don't make a release.

- **App**: fawtboard checks for a new release at startup and then every hour, and downloads it in the background. Once it has downloaded, a notification appears, a glowing arrow shows at the right of the status bar, and the tray menu offers **Restart to update**. **Settings → Updates** shows the same and has **Install updates automatically**. With that on, a downloaded update installs when you quit fawtboard, or at the next start if it never quit cleanly.
- **Stream Deck plugin**: each app release bundles the matching plugin. When the plugin that connects is older, fawtboard offers **Install in Stream Deck** (status bar arrow, tray, Settings → Updates). With automatic updates on, it opens the plugin in Stream Deck by itself, once per version. The plugin's version only changes when the plugin's code does.

Running the install commands again also updates. Your board and settings are kept either way.

## 3. Build it yourself (optional)

You need [Git](https://git-scm.com/download/win) and [Node.js](https://nodejs.org/) 22.12 or newer. Build the plugin first, because the app bundles it:

```powershell
git clone https://github.com/Nick2191/fawtboard.git
cd fawtboard
npm install
npm run pack -w @fawtboard/streamdeck-plugin
npm run build:win -w @fawtboard/desktop
```

That produces:

| File                                                                  | What it is             |
| --------------------------------------------------------------------- | ---------------------- |
| `apps\desktop\dist\fawtboard-<version>-setup.exe`                     | The app installer      |
| `apps\streamdeck-plugin\dist\com.nick2191.fawtboard.streamDeckPlugin` | The Stream Deck plugin |

Both can also be built on Linux with the same commands and copied over. The app build needs Wine there. A local build keeps the version in `package.json` (1.0.0), which is lower than any release. So once it is installed, it updates itself to the latest release.

The installer isn't code-signed. If you run a downloaded copy, Windows SmartScreen may block it: choose **More info** → **Run anyway**. The install script and the updater don't trigger SmartScreen.

## 4. Bring your board across (optional)

Your board lives outside the repository, in the app's data folder:

| System  | Folder                                    |
| ------- | ----------------------------------------- |
| Windows | `%APPDATA%\fawtboard`                     |
| Linux   | `~/.config/fawtboard`                     |
| macOS   | `~/Library/Application Support/fawtboard` |

Quit fawtboard on both machines (tray icon → Quit), then copy `library.json` and the `images` folder into the new machine's folder. That carries over your sounds' names, colors, images, volumes, play modes and order, plus your settings.

It does not carry the sound files. fawtboard plays them from wherever they were and stores each one's full path, so:

- Copy the audio files to the new machine yourself.
- Unless they end up at exactly the same paths, every pad will say **Can't play**. Click each one and use **Replace file…** to point it at the file's new location. Coming from Linux this is always the case.
- If you pinned a folder under Settings → Library, pick it again.
- Check Settings → Audio. Devices the new machine doesn't have show as unplugged until you pick others.

Trimmed sounds play from copies in the `sounds` folder; copy it too. Their paths change with the data folder, so they need **Replace file…** like any other moved sound (pick the copy in the new `sounds` folder), or trim the original again.

Copying `library.json` keeps each sound's id, and Stream Deck keys are bound to those ids. A Stream Deck profile you restore on the new machine therefore keeps working; on a fresh profile, pick each key's sound again.

If you would rather start clean, skip this section and add your sounds in the app.

## If something goes wrong

- **`npm install` or a build command fails on an old Node**: check `node --version`. The build tools need 22.12 or newer (20.19 or newer on the 20 line).
- **The app build fails with "A required privilege is not held by the client"**: electron-builder is unpacking its tools and needs permission to create symbolic links. Turn on Developer Mode in Windows settings, or run PowerShell as administrator, and build again.
- **The plugin doesn't appear in Stream Deck**: update the Stream Deck app to 7.1 or newer, then double-click the plugin file again.
- **Keys show the alert triangle**: fawtboard isn't running, or the sound behind the key was removed or its file is missing. Start fawtboard; the plugin reconnects within about 2 seconds. The bottom-right corner of the window shows whether the plugin is connected.
- **"Stream Deck control is off: port 39217 is in use"** (bottom-right of the window): another program, or a second copy of fawtboard, holds the port. Quit it and restart fawtboard.
- **A sound has a dashed red outline and says "Can't play"**: its file was moved or can't be decoded. Click it to see why, then use **Replace file…**. The sound keeps its settings and its Stream Deck keys.
- **"Sounds are silent right now"** or an output is highlighted as unplugged: pick a connected device in Settings → Audio. An unplugged device reconnects on its own when it comes back.
- **Sounds crackle**: set every device in the chain to the same sample rate (48000 Hz is a safe choice) under Windows Sound settings → More sound settings → device → Advanced.
