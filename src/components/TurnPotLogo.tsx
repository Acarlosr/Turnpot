/**
 * TurnPotLogo — inline SVG version of the favicon logomark.
 * Four member dots on a ring, one highlighted, USDC-blue central coin.
 */

interface Props {
  size?: number
  className?: string
}

export default function TurnPotLogo({ size = 24, className }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      {/* Dark background */}
      <circle cx="16" cy="16" r="15.5" fill="#0f172a" />

      {/* Dashed connector ring */}
      <circle
        cx="16" cy="16" r="9"
        fill="none"
        stroke="#334155"
        strokeWidth="0.8"
        strokeDasharray="2 2.5"
      />

      {/* Inactive member dots */}
      <circle cx="25" cy="16" r="2.2" fill="#64748b" />
      <circle cx="16" cy="25" r="2.2" fill="#64748b" />
      <circle cx="7"  cy="16" r="2.2" fill="#64748b" />

      {/* Highlighted member (top / this round) */}
      <circle cx="16" cy="7" r="4.0" fill="#2775CA" opacity={0.18} />
      <circle cx="16" cy="7" r="2.8" fill="#2775CA" />

      {/* Central USDC-blue coin */}
      <circle cx="16" cy="16" r="5.2" fill="#2775CA" />
      <circle cx="16" cy="16" r="5.2" fill="none" stroke="#1a5fa8" strokeWidth="0.7" />
      <text
        x="16" y="19.9"
        textAnchor="middle"
        fontFamily="'Arial Black',Arial,sans-serif"
        fontSize="6.8"
        fontWeight="800"
        fill="#ffffff"
      >
        $
      </text>
    </svg>
  )
}
