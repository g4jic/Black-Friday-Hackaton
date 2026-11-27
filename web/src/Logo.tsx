import { useId } from "react"
import { cx } from "./ui"

/**
 * The SuiteSpot mark (the same drawing as web/public/suitespot-logo.svg, which stays the favicon), inline so its
 * parts can move: on hover the magnifier (handle and ring, two groups so the paint order stays the same) turns a
 * little counter-clockwise around the centre of the ring, while the glass, the glint and the building stay still.
 * CSS in index.css (.ss-logo); none with prefers-reduced-motion. Ids are per instance (useId).
 */
export function Logo({ size, title, className }: { size: number; title?: string; className?: string }) {
  const id = useId().replace(/:/g, "")
  const ref = (name: string) => `url(#${name}-${id})`
  return (
    <svg
      viewBox="0 0 480 480"
      width={size}
      height={size}
      className={cx("ss-logo", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <radialGradient id={`lens-${id}`} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.65" stopColor="#FBF1F8" />
          <stop offset="1" stopColor="#EEE3FB" />
        </radialGradient>
        <linearGradient id={`coral-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F7A48C" />
          <stop offset="0.55" stopColor="#F25C54" />
          <stop offset="1" stopColor="#E5483F" />
        </linearGradient>
        <linearGradient id={`ink-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2E2E38" />
          <stop offset="1" stopColor="#0B0B0F" />
        </linearGradient>
        <clipPath id={`cA-${id}`}>
          <circle cx="212" cy="212" r="146" />
        </clipPath>
      </defs>
      <g className="ss-logo-lens">
        <line x1="337.9" y1="337.9" x2="388.8" y2="388.8" stroke={ref("ink")} strokeWidth="64" strokeLinecap="round" />
      </g>
      <circle cx="212" cy="212" r="164" fill={ref("lens")} />
      <g clipPath={ref("cA")}>
        <polygon points="191.1,314.2 125.6,276.4 125.6,179.8 191.1,217.6" fill="#D9BFF4" />
        <polygon points="178.4,258.5 162.0,249.1 162.0,223.9 178.4,233.3" fill="#8F5FD0" />
        <polygon points="152.9,243.8 136.5,234.4 136.5,209.2 152.9,218.6" fill="#8F5FD0" />
        <polygon points="191.1,314.2 298.4,252.2 298.4,155.6 191.1,217.6" fill="#FFFFFF" />
        <polygon points="198.4,310.0 291.1,256.4 291.1,210.2 198.4,263.8" fill="#C19BE9" />
        <polygon points="211.1,302.6 231.1,291.1 231.1,249.1 211.1,260.6" fill="#0B0B0F" />
        <polygon points="194.7,265.9 294.7,208.1 294.7,197.6 194.7,255.4" fill="#F25C54" />
        <polygon points="245.6,217.6 263.8,207.1 263.8,188.2 245.6,198.7" fill="#C19BE9" />
        <polygon points="271.1,202.9 289.3,192.4 289.3,173.5 271.1,184.0" fill="#C19BE9" />
        <polygon points="191.1,217.6 298.4,155.6 232.9,117.8 125.6,179.8" fill="#F25C54" />
        <polygon points="191.1,208.1 282.0,155.6 232.9,127.3 142.0,179.8" fill="#F7A48C" />
      </g>
      <path d="M 88 184 A 124 124 0 0 1 184 88" fill="none" stroke="#fff" strokeWidth="14" strokeLinecap="round" opacity="0.9" />
      <g className="ss-logo-lens">
        <circle cx="212" cy="212" r="164" fill="none" stroke={ref("coral")} strokeWidth="40" />
      </g>
    </svg>
  )
}
