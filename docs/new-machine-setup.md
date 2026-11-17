# Set up on a new Windows machine

The installers are built from this repository; they aren't checked in or published anywhere. This gets you from a fresh Windows machine to a working fawtboard and Stream Deck plugin.

## 1. Prerequisites

- [Git](https://git-scm.com/download/win)
- [Node.js](https://nodejs.org/) 22.12 or newer (npm comes with it)
- The Elgato Stream Deck app 7.1 or newer, if you use the plugin

## 2. Build the installers

In PowerShell:

```powershell
git clone https://github.com/Nick2191/fawtboard.git
cd fawtboard
npm install
npm run build:win -w @fawtboard/desktop
npm run pack -w @fawtboard/streamdeck-plugin
```

That produces:

| File                                                                  | What it is             |
| --------------------------------------------------------------------- | ---------------------- |
| `apps\desktop\dist\fawtboard-<version>-setup.exe`                     | The app installer      |
| `apps\streamdeck-plugin\dist\com.nick2191.fawtboard.streamDeckPlugin` | The Stream Deck plugin |

Both can also be built on Linux with the same two commands and copied over. The app build needs Wine there.

## 3. Install

1. Run `fawtboard-<version>-setup.exe`. The installer isn't code-signed, so Windows SmartScreen may block it: choose **More info** → **Run anyway**.
2. Double-click `com.nick2191.fawtboard.streamDeckPlugin`. Stream Deck installs it and adds a **fawtboard** category to the action list.
3. Follow [windows-audio-setup.md](windows-audio-setup.md) to route sound into Discord. Its install step is the two files above plus Voicemeeter Banana.

To update later, `git pull`, run the two build commands again, and install over the top. Your board and settings are kept.

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

Copying `library.json` keeps each sound's id, and Stream Deck keys are bound to those ids. A Stream Deck profile you restore on the new machine therefore keeps working; on a fresh profile, pick each key's sound again.

If you would rather start clean, skip this section and add your sounds in the app.

## If something goes wrong

- **`npm install` or a build command fails on an old Node**: check `node --version`. The build tools need 22.12 or newer (20.19 or newer on the 20 line).
- **The app build fails with "A required privilege is not held by the client"**: electron-builder is unpacking its tools and needs permission to create symbolic links. Turn on Developer Mode in Windows settings, or run PowerShell as administrator, and build again.
- **The plugin doesn't appear in Stream Deck**: update the Stream Deck app to 7.1 or newer, then double-click the plugin file again.
- **Keys show the alert triangle**: fawtboard isn't running, or the sound behind the key can't be played. See the troubleshooting list in [windows-audio-setup.md](windows-audio-setup.md).
