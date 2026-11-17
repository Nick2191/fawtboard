import type { Sound } from '../../../shared/types'

/** Pad colours, tuned to stay legible as both a tint and a solid on the dark background. */
export const PAD_COLORS = {
  red: '#ff6b6b',
  orange: '#ff9f4a',
  yellow: '#f5cf4f',
  green: '#4cd98a',
  teal: '#2ed3c6',
  blue: '#5aa9ff',
  violet: '#a08fff',
  pink: '#ff7ac3'
}

export type PadColor = keyof typeof PAD_COLORS

const KEYS = Object.keys(PAD_COLORS) as PadColor[]

/** The sound's chosen colour, or a stable one derived from its id so a new board isn't monochrome. */
export function padColor(sound: Pick<Sound, 'id' | 'color'>): PadColor {
  if (sound.color && Object.hasOwn(PAD_COLORS, sound.color)) return sound.color as PadColor
  let hash = 0
  for (const char of sound.id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return KEYS[hash % KEYS.length]
}
