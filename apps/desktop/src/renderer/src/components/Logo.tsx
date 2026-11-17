/** The app mark: a 2×2 pad grid with one pad lit. Mirrors build/icon.svg. */
export default function Logo({ size = 24 }: { size?: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8f7dff" />
          <stop offset="1" stopColor="#5b46e8" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#logo-bg)" />
      <rect x="13" y="13" width="17" height="17" rx="5" fill="#fff" />
      <rect x="34" y="13" width="17" height="17" rx="5" fill="#fff" fillOpacity="0.35" />
      <rect x="13" y="34" width="17" height="17" rx="5" fill="#fff" fillOpacity="0.35" />
      <rect x="34" y="34" width="17" height="17" rx="5" fill="#fff" fillOpacity="0.35" />
    </svg>
  )
}
