import { cn } from "@/lib/utils";

// Brand isotype from "Identidad serrana: Reservas Traslasierra": a roof shaped like the sierra, the
// sun behind it, a four-pane window and the green hill swoosh. "light" is for photos and dark fills.

type Tone = "color" | "light";

export function BrandMark({ tone = "color", className }: { tone?: Tone; className?: string }) {
  const roof = tone === "light" ? "#FFFFFF" : "var(--brand-green)";
  const hill = tone === "light" ? "#FFFFFF" : "var(--brand-olive)";
  return (
    <svg viewBox="0 0 120 84" aria-hidden="true" className={cn("shrink-0", className)}>
      <circle cx="80" cy="22" r="14" fill="var(--brand-ochre)" />
      <path
        d="M8 56 L47 20 L70 41 M62 33 L74 26 L104 54"
        fill="none"
        stroke={roof}
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g fill={roof}>
        <rect x="38" y="40" width="7" height="7" rx="1" />
        <rect x="47" y="40" width="7" height="7" rx="1" />
        <rect x="38" y="49" width="7" height="7" rx="1" />
        <rect x="47" y="49" width="7" height="7" rx="1" />
      </g>
      <path d="M6 70 C34 56 70 58 112 70" fill="none" stroke={hill} strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

/** Horizontal lockup: isotype plus the two-line wordmark. */
export function BrandLogo({ tone = "color", className }: { tone?: Tone; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <BrandMark tone={tone} className="h-9 w-auto" />
      <span
        className={cn(
          "font-display text-[0.95rem] leading-[1.05] font-bold",
          tone === "light" ? "text-white" : "text-[var(--brand-green)]",
        )}
      >
        Reservas
        <br />
        Traslasierra
      </span>
    </span>
  );
}
