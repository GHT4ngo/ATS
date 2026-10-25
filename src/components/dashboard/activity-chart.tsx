"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type ChartSeries = {
  key: "applications" | "interviews" | "hires";
  label: string;
  /** A CSS colour; the same entity keeps the same colour everywhere. */
  color: string;
  values: number[];
};

const HEIGHT = 220;
const PAD = { top: 12, right: 12, bottom: 28, left: 32 };

function niceMax(n: number) {
  if (n <= 4) return 4;
  const step = Math.ceil(n / 4);
  return step * 4;
}

/** Lines over time with a crosshair tooltip; the legend toggles a series. */
export function ActivityChart({
  series,
  labels,
  longLabels,
  caption,
}: {
  series: ChartSeries[];
  /** Short axis labels, one per bucket. */
  labels: string[];
  /** Tooltip and table labels, one per bucket. */
  longLabels: string[];
  caption: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  // Measured on mount; small until then, so it never widens its container.
  const [width, setWidth] = useState(280);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<number | null>(null);
  const gradient = useId();

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) =>
      setWidth(Math.max(280, entry.contentRect.width)),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const shown = series.filter((s) => !hidden.has(s.key));
  const n = labels.length;
  const max = niceMax(Math.max(0, ...shown.flatMap((s) => s.values)));
  const innerW = width - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) =>
    PAD.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const ticks = [0, max / 4, max / 2, (3 * max) / 4, max];
  // Enough axis labels to read, never so many that they collide.
  const every = Math.max(
    1,
    Math.ceil(n / Math.max(2, Math.floor(innerW / 70))),
  );
  const slot = innerW / Math.max(1, n - 1);

  function toggle(key: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  return (
    <figure className="grid min-w-0 gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label={caption}>
        {series.map((s) => {
          const on = !hidden.has(s.key);
          return (
            <button
              key={s.key}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(s.key)}
              className={cn(
                "hover:bg-muted/60 ring-foreground/10 flex items-center gap-2 rounded-full px-3 py-1 text-sm ring-1 transition-opacity",
                !on && "opacity-50",
              )}
            >
              <span
                className="size-2.5 rounded-full"
                style={{ background: s.color }}
                aria-hidden
              />
              <span>{s.label}</span>
              <span className="font-semibold tabular-nums">
                {s.values.reduce((a, b) => a + b, 0)}
              </span>
            </button>
          );
        })}
      </div>
      <div
        ref={box}
        className="relative w-full"
        onMouseLeave={() => setHover(null)}
      >
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={caption}
          className="block overflow-visible"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(t)}
                y2={y(t)}
                className="stroke-border"
                strokeDasharray={t === 0 ? undefined : "2 4"}
              />
              <text
                x={PAD.left - 8}
                y={y(t)}
                dy="0.32em"
                textAnchor="end"
                className="fill-muted-foreground text-[11px] tabular-nums"
              >
                {Number.isInteger(t) ? t : ""}
              </text>
            </g>
          ))}
          {labels.map((label, i) =>
            // Counted from the end, so today always has a label.
            (n - 1 - i) % every === 0 ? (
              <text
                key={i}
                x={x(i)}
                y={HEIGHT - 8}
                textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
                className="fill-muted-foreground text-[11px]"
              >
                {label}
              </text>
            ) : null,
          )}
          {hover !== null && (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top}
              y2={PAD.top + innerH}
              className="stroke-muted-foreground/50"
            />
          )}
          <defs>
            {shown.map((s) => (
              <linearGradient
                key={s.key}
                id={`${gradient}-${s.key}`}
                x1="0"
                x2="0"
                y1="0"
                y2="1"
              >
                <stop offset="0%" stopColor={s.color} stopOpacity={0.16} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          {shown.map((s) => (
            <polygon
              key={`${s.key}-${n}`}
              className="chart-area"
              fill={`url(#${gradient}-${s.key})`}
              points={[
                ...s.values.map((v, i) => `${x(i)},${y(v)}`),
                `${x(n - 1)},${y(0)}`,
                `${x(0)},${y(0)}`,
              ].join(" ")}
            />
          ))}
          {shown.map((s) => (
            <polyline
              // A new key per range replays the drawing animation.
              key={`${s.key}-${n}`}
              className="chart-line"
              pathLength={1}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
            />
          ))}
          {hover !== null &&
            shown.map((s) => (
              <circle
                key={s.key}
                cx={x(hover)}
                cy={y(s.values[hover])}
                r={4}
                fill={s.color}
                className="stroke-card"
                strokeWidth={2}
              />
            ))}
          {labels.map((_, i) => (
            <rect
              key={i}
              x={x(i) - slot / 2}
              y={PAD.top}
              width={slot}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onTouchStart={() => setHover(i)}
            />
          ))}
        </svg>
        {hover !== null && (
          <div
            className="bg-popover text-popover-foreground pointer-events-none absolute top-0 z-10 grid min-w-36 gap-1 rounded-md border px-3 py-2 text-xs shadow-md"
            style={{
              left: Math.min(Math.max(0, x(hover) - 72), width - 150),
            }}
          >
            <span className="font-medium">{longLabels[hover]}</span>
            {shown.map((s) => (
              <span key={s.key} className="flex items-center gap-2">
                <span
                  className="size-2 rounded-full"
                  style={{ background: s.color }}
                  aria-hidden
                />
                <span className="flex-1">{s.label}</span>
                <span className="font-semibold tabular-nums">
                  {s.values[hover]}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col" />
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {longLabels.map((label, i) => (
            <tr key={i}>
              <th scope="row">{label}</th>
              {series.map((s) => (
                <td key={s.key}>{s.values[i]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
