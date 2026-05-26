// Inline ClauseGuard logo — a shield with a pillar/serif "C" notch.
// Monochrome via `currentColor`, scales cleanly from 20px to 200px.

import { cn } from "@/lib/utils";

export function Logo({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      role="img"
      aria-label="ClauseGuard"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={cn("text-primary", className)}
    >
      <path
        d="M16 3.5 L27 7.6 V15.4 C27 21.4 22.6 26.6 16 28.5 C9.4 26.6 5 21.4 5 15.4 V7.6 Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M11 14 V18 M16 12 V20 M21 14 V18"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M9 16.5 H23"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.45"
      />
    </svg>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Logo size={26} />
      <div className="leading-none">
        <div className="font-semibold tracking-tight text-[15px]" data-testid="text-brand">
          ClauseGuard
        </div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mt-0.5">
          Compliance · Audit · AI
        </div>
      </div>
    </div>
  );
}
