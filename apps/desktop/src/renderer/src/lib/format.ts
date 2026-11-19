/** Short clips read better with a decimal ("0.4s"); longer ones as a clock ("1:05"). */
export function formatDuration(seconds: number): string {
  if (seconds < 10) return `${seconds.toFixed(1)}s`
  const whole = Math.round(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/** A position within a sound, to the hundredth: "0:03.40", "1:05.00". */
export function formatTimestamp(seconds: number): string {
  const hundredths = Math.round(seconds * 100)
  const minutes = Math.floor(hundredths / 6000)
  const rest = hundredths % 6000
  const secs = String(Math.floor(rest / 100)).padStart(2, '0')
  return `${minutes}:${secs}.${String(rest % 100).padStart(2, '0')}`
}
