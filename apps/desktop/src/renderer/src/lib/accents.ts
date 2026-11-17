/** Accent choices as OKLCH hues. The stylesheet derives every accent shade from `--accent-h`. */
export const ACCENTS = {
  violet: 283,
  blue: 255,
  teal: 195,
  green: 152,
  orange: 55,
  pink: 350
}

export type Accent = keyof typeof ACCENTS

/** The hue for a saved accent key, falling back to violet for keys this version doesn't know. */
export function accentHue(key: string): number {
  return Object.hasOwn(ACCENTS, key) ? ACCENTS[key as Accent] : ACCENTS.violet
}
