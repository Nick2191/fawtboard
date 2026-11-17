#!/usr/bin/env bash
# Generates synthetic test sounds for fawtboard into test-sounds/ (gitignored).
# Covers every format the picker accepts, odd sample rates and channel layouts,
# volume extremes, long clips for toggle/stop-all, and broken files for the
# error state. Everything is synthesized, so there are no licensing questions.
set -euo pipefail

command -v ffmpeg >/dev/null || { echo "ffmpeg is required" >&2; exit 1; }

out="$(cd "$(dirname "$0")/.." && pwd)/test-sounds"
rm -rf "$out"
mkdir -p "$out"

gen() { ffmpeg -hide_banner -loglevel error -y "$@"; }

# Short, punchy clips for restart and overlap modes.
gen -f lavfi -i "sine=f=880:d=0.25" -af "afade=out:st=0.15:d=0.1" "$out/01 beep.wav"
gen -f lavfi -i "aevalsrc='0.3*(sin(2*PI*466*t)+sin(2*PI*587*t)+sin(2*PI*698*t))*(1-t/1.2)':d=1.2:s=48000" \
  -c:a libmp3lame -q:a 2 "$out/02 airhorn chord.mp3"
gen -f lavfi -i "anoisesrc=d=0.4:c=pink:a=0.8" -af "afade=out:st=0:d=0.4,lowpass=f=3000" "$out/03 snare hit.wav"
gen -f lavfi -i "aevalsrc='0.5*sin(2*PI*(300*t+900*t*t))':d=0.8:s=44100" \
  -c:a libvorbis -q:a 5 "$out/04 rising chirp.ogg"
gen -f lavfi -i "aevalsrc='0.5*sin(2*PI*(1200*t-500*t*t))*exp(-2*t)':d=1.0:s=48000" \
  -c:a libopus -b:a 96k "$out/05 falling zap (opus).ogg"

# Two-tone doorbell, with a filename that has spaces, an en dash and accents.
gen -f lavfi -i "aevalsrc='0.5*(lt(t,0.5)*sin(2*PI*659*t)+gte(t,0.5)*sin(2*PI*523*t))*exp(-3*mod(t,0.5))':d=1.0:s=44100" \
  -c:a libmp3lame -q:a 2 "$out/06 ding dong – ünïcode.mp3"

# Channel check: left ear, then right ear. Tells you the device isn't swapping or downmixing.
gen -f lavfi -i "aevalsrc='lt(t,1)*0.5*sin(2*PI*440*t)|gte(t,1)*0.5*sin(2*PI*660*t)':d=2:s=48000" \
  -c:a flac "$out/07 left then right.flac"

# AAC in an m4a container.
gen -f lavfi -i "aevalsrc='0.4*sin(2*PI*330*t)*sin(2*PI*4*t)':d=1.5:s=44100" \
  -c:a aac -b:a 128k "$out/08 wobble.m4a"

# Resampling: 22.05 kHz mono, so the engine has to convert it.
gen -f lavfi -i "sine=f=523:d=1" -ar 22050 -ac 1 "$out/09 low rate mono 22k.wav"

# Volume extremes for the per-sound and per-output sliders.
gen -f lavfi -i "sine=f=440:d=1.5" -af "volume=-30dB" "$out/10 very quiet.wav"
gen -f lavfi -i "aevalsrc='0.98*sin(2*PI*220*t)':d=1.5:s=48000" "$out/11 very loud.wav"

# One second of silence before a click: shows whether playback starts late or trims leading silence.
gen -f lavfi -i "aevalsrc='gte(t,1)*lt(t,1.02)*0.8*sin(2*PI*1000*t)':d=1.5:s=48000" "$out/12 silence then click.wav"

# Long clips for toggle mode and Stop All.
gen -f lavfi -i "aevalsrc='0.3*sin(2*PI*(200+150*sin(2*PI*0.25*t))*t)':d=10:s=48000" \
  -c:a libmp3lame -q:a 4 "$out/13 ten second siren.mp3"
gen -f lavfi -i "anoisesrc=d=60:c=brown:a=0.3" -af "lowpass=f=800" \
  -c:a libvorbis -q:a 3 "$out/14 one minute rumble.ogg"

# Broken files for the red/disabled error state.
head -c 4096 /dev/urandom >"$out/90 broken random bytes.mp3"
: >"$out/91 empty file.wav"
echo "this is not audio" >"$out/92 text renamed.ogg"

echo "Wrote $(find "$out" -type f | wc -l) files to $out"
