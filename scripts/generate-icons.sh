#!/usr/bin/env bash
# Regenerates every app icon from apps/desktop/build/icon.svg:
#   build/icon.png      512px, Linux packages and electron-builder's fallback
#   build/icon.ico      Windows installer and executable
#   build/icon.icns     macOS bundle
#   resources/icon.png  window and tray icon at runtime
# Needs rsvg-convert (librsvg), magick (ImageMagick) and node.
set -euo pipefail

for tool in rsvg-convert magick node; do
  command -v "$tool" >/dev/null || { echo "$tool is required" >&2; exit 1; }
done

desktop="$(cd "$(dirname "$0")/../apps/desktop" && pwd)"
svg="$desktop/build/icon.svg"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

for size in 16 24 32 48 64 128 256 512 1024; do
  rsvg-convert -w "$size" -h "$size" "$svg" -o "$tmp/$size.png"
done

cp "$tmp/512.png" "$desktop/build/icon.png"
cp "$tmp/512.png" "$desktop/resources/icon.png"
magick "$tmp"/{16,24,32,48,64,128,256}.png "$desktop/build/icon.ico"

# ICNS is a flat container: a header, then one typed, length-prefixed PNG per size.
node - "$tmp" "$desktop/build/icon.icns" <<'EOF'
const fs = require('fs')
const [dir, out] = process.argv.slice(2)
const types = { ic07: 128, ic08: 256, ic09: 512, ic10: 1024 }
const entries = Object.entries(types).map(([type, size]) => {
  const png = fs.readFileSync(`${dir}/${size}.png`)
  const header = Buffer.alloc(8)
  header.write(type, 0, 'ascii')
  header.writeUInt32BE(png.length + 8, 4)
  return Buffer.concat([header, png])
})
const body = Buffer.concat(entries)
const header = Buffer.alloc(8)
header.write('icns', 0, 'ascii')
header.writeUInt32BE(body.length + 8, 4)
fs.writeFileSync(out, Buffer.concat([header, body]))
EOF

echo "Wrote icon.png, icon.ico and icon.icns to $desktop/build, and resources/icon.png"
