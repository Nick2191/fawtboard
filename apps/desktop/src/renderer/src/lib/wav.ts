/** Encodes `start`–`end` (seconds) of `buffer` as a 16-bit PCM WAV file at the buffer's rate. */
export function encodeWav(buffer: AudioBuffer, start: number, end: number): ArrayBuffer {
  const { numberOfChannels: channels, sampleRate, length } = buffer
  const clamp = (n: number, lo: number, hi: number): number => Math.min(Math.max(n, lo), hi)
  const from = clamp(Math.round(start * sampleRate), 0, length)
  const to = clamp(Math.round(end * sampleRate), from, length)
  const frames = to - from
  const blockAlign = channels * 2
  const dataSize = frames * blockAlign

  const out = new ArrayBuffer(44 + dataSize)
  const view = new DataView(out)
  const ascii = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }
  ascii(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  ascii(36, 'data')
  view.setUint32(40, dataSize, true)

  const data = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c))
  let offset = 44
  for (let i = from; i < to; i++) {
    for (let c = 0; c < channels; c++) {
      const s = clamp(data[c][i], -1, 1)
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      offset += 2
    }
  }
  return out
}
