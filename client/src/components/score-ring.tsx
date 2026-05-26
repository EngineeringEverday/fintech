// Animated compliance score ring. Renders the moment Agent 2 finishes; the
// fill smoothly animates from 0 to the computed score.

import { useEffect, useRef, useState } from "react";
import { ringColor } from "@/lib/score";

interface Props {
  score: number;
  size?: number;
  stroke?: number;
  label?: string;
  /** Reset the animation when this key changes. */
  animationKey?: string | number;
}

export function ScoreRing({ score, size = 280, stroke = 18, label, animationKey }: Props) {
  const [progress, setProgress] = useState(0);
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setProgress(0);
    setDisplay(0);
    // Slight delay so the CSS transition kicks in
    const t = setTimeout(() => setProgress(Math.max(0, Math.min(100, score))), 60);

    // Number tween
    const start = performance.now();
    const dur = 1400;
    const target = Math.max(0, Math.min(100, score));
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - k, 3); // ease-out cubic
      setDisplay(Math.round(eased * target));
      if (k < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      clearTimeout(t);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score, animationKey]);

  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - progress / 100);
  const colors = ringColor(score);

  return (
    <div
      className="relative grid place-items-center"
      style={{ width: size, height: size }}
      data-testid="score-ring"
    >
      <svg width={size} height={size} className="-rotate-90 block">
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={colors.stroke} stopOpacity="1" />
            <stop offset="100%" stopColor={colors.stroke} stopOpacity="0.55" />
          </linearGradient>
          <filter id="ring-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="hsl(var(--border))"
          strokeWidth={stroke}
          fill="none"
          opacity={0.55}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ring-grad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          filter="url(#ring-glow)"
          style={{
            transition: "stroke-dashoffset 1400ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
        {/* Tick marks every 10% */}
        {Array.from({ length: 36 }).map((_, i) => {
          const angle = (i / 36) * Math.PI * 2;
          const x1 = size / 2 + Math.cos(angle) * (r - stroke / 2 - 8);
          const y1 = size / 2 + Math.sin(angle) * (r - stroke / 2 - 8);
          const x2 = size / 2 + Math.cos(angle) * (r - stroke / 2 - 14);
          const y2 = size / 2 + Math.sin(angle) * (r - stroke / 2 - 14);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="hsl(var(--muted-foreground))"
              strokeOpacity={i % 3 === 0 ? 0.55 : 0.18}
              strokeWidth={i % 3 === 0 ? 1.4 : 1}
            />
          );
        })}
      </svg>

      <div className="absolute inset-0 grid place-items-center text-center">
        <div className="flex flex-col items-center">
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-2">
            Compliance Score
          </div>
          <div
            className="font-semibold tabular-nums tracking-tight leading-none"
            style={{ fontSize: size * 0.28, color: colors.stroke }}
            data-testid="text-score"
          >
            {display}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 tabular-nums">/ 100</div>
          <div
            className="mt-3 px-3 py-1 rounded-full text-[11px] font-medium uppercase tracking-wider"
            style={{ background: colors.bg, color: colors.stroke }}
            data-testid="badge-score-label"
          >
            {label ?? colors.label}
          </div>
        </div>
      </div>
    </div>
  );
}
