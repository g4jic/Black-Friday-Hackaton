/** The SuiteSpot mark: a magnifying glass looking into a small commercial building (shopfront with an awning). */
export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {/* the lens */}
      <circle cx="13.5" cy="13.5" r="9.5" />
      {/* the handle */}
      <path d="M20.5 20.5 28 28" />
      {/* the building inside the lens: roof line, awning, door */}
      <path d="M8.5 12.5h10" />
      <path d="M9.5 12.5v6h8v-6" />
      <path d="M8.5 12.5 10 9.5h7l1.5 3" />
      <path d="M12.5 18.5v-3h2v3" />
    </svg>
  )
}
