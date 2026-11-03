import { cn } from "@/lib/utils";

// Layered ridges of the Sierras de Córdoba at dusk, drawn with the brand palette. Stands in for a
// landscape photo where the platform has none of its own (home hero, pages without photos).
export function Sierras({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1440 560"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      className={cn("block h-full w-full", className)}
    >
      <defs>
        <linearGradient id="sierras-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6dcb5" />
          <stop offset="0.55" stopColor="#f4e9db" />
          <stop offset="1" stopColor="#e9e2c9" />
        </linearGradient>
      </defs>
      <rect width="1440" height="560" fill="url(#sierras-sky)" />
      <circle cx="1060" cy="250" r="64" fill="#e5a048" />
      <path
        fill="#b9c39b"
        d="M0 330 L120 290 L210 312 L330 240 L430 286 L560 214 L690 276 L800 236 L930 292 L1050 228 L1180 282 L1300 246 L1440 300 V560 H0 Z"
      />
      <path
        fill="#7a9b58"
        d="M0 392 L150 336 L260 368 L390 306 L520 360 L640 318 L760 372 L900 330 L1030 382 L1160 336 L1300 374 L1440 344 V560 H0 Z"
      />
      <path
        fill="#1f5a46"
        d="M0 452 C180 404 330 430 480 412 C640 392 780 446 960 428 C1120 412 1280 438 1440 418 V560 H0 Z"
      />
      <path fill="#163f32" d="M0 512 C240 474 520 500 760 488 C1000 476 1220 500 1440 484 V560 H0 Z" />
    </svg>
  );
}
