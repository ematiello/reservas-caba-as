import { BRAND_GREEN_DEEP, BRAND_OCHRE, BRAND_OLIVE } from "./colors";

// App icon artwork for `ImageResponse` (next/og), which cannot resolve CSS variables: the same
// isotype as `BrandMark` in logo.tsx, in light tone, on the deep green. The mark takes 60% of the
// width, which also fits the safe zone of a maskable icon (a centered circle of 80% of the side).
export function AppIconArt({ size }: { size: number }) {
  const width = size * 0.6;
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BRAND_GREEN_DEEP,
      }}
    >
      <svg width={width} height={width * 0.7} viewBox="0 0 120 84" fill="none">
        <circle cx="80" cy="22" r="14" fill={BRAND_OCHRE} />
        <path
          d="M8 56 L47 20 L70 41 M62 33 L74 26 L104 54"
          stroke="#FFFFFF"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="38" y="40" width="7" height="7" rx="1" fill="#FFFFFF" />
        <rect x="47" y="40" width="7" height="7" rx="1" fill="#FFFFFF" />
        <rect x="38" y="49" width="7" height="7" rx="1" fill="#FFFFFF" />
        <rect x="47" y="49" width="7" height="7" rx="1" fill="#FFFFFF" />
        <path d="M6 70 C34 56 70 58 112 70" stroke={BRAND_OLIVE} strokeWidth="6" strokeLinecap="round" />
      </svg>
    </div>
  );
}
