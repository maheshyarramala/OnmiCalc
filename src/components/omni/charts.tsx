import { useId } from "react";
import { money } from "@/lib/format";
import type { YearlyBreakdown } from "@/lib/calc/investment";

export interface Slice {
  label: string;
  value: number;
  color: string; // CSS color or var(--token)
}

/** DonutChart.kt equivalent */
export function Donut({ slices, size = 180, stroke = 26, centerTitle, centerSubtitle }: { slices: Slice[]; size?: number; stroke?: number; centerTitle?: string; centerSubtitle?: string }) {
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
          {total > 0 &&
            slices.map((s) => {
              const len = Math.round((Math.max(0, s.value) / total) * c * 100) / 100;
              const el = (
                <circle key={s.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={stroke} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} className="transition-all duration-700" />
              );
              offset += len;
              return len > 0 ? el : null;
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          {centerSubtitle && <span className="text-xs text-muted-foreground">{centerSubtitle}</span>}
          {centerTitle && <span className="font-display text-sm font-bold leading-tight tabular-nums sm:text-base">{centerTitle}</span>}
        </div>
      </div>
      <div className="flex w-full flex-wrap justify-center gap-x-5 gap-y-2">
        {slices.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-xs">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="font-semibold">{s.label}</span>
            <span className="text-muted-foreground">
              {total > 0 ? Math.trunc((s.value / total) * 100) : 0}% ({money(s.value)})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** GrowthLineChart.kt equivalent */
export function GrowthChart({ data }: { data: YearlyBreakdown[] }) {
  const gid = useId().replace(/:/g, "");
  if (data.length < 2) return null;
  const w = 320;
  const h = 140;
  const max = Math.max(1, ...data.map((d) => d.balance));
  // Rounded so server and browser math produce identical SVG paths.
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const x = (i: number) => r2((i / (data.length - 1)) * w);
  const y = (v: number) => r2(h - (v / max) * h * 0.9);
  const smooth = (vals: number[]) =>
    vals.reduce((p, v, i) => {
      if (i === 0) return `M ${x(0)} ${y(v)}`;
      const mx = (x(i - 1) + x(i)) / 2;
      return `${p} C ${mx} ${y(vals[i - 1] ?? 0)}, ${mx} ${y(v)}, ${x(i)} ${y(v)}`;
    }, "");
  const bal = smooth(data.map((d) => d.balance));
  const inv = smooth(data.map((d) => d.invested));
  const n = data.length;
  return (
    <div className="rounded-3xl border bg-card p-4">
      <p className="font-display font-bold">Wealth Growth Projection</p>
      <p className="text-xs text-muted-foreground">Year-by-year compounding balance</p>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 h-36 w-full overflow-visible" preserveAspectRatio="none">
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-gain)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--chart-gain)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={`${bal} L ${w} ${h} L 0 ${h} Z`} fill={`url(#${gid})`} />
        <path d={bal} fill="none" stroke="var(--chart-gain)" strokeWidth={3} vectorEffect="non-scaling-stroke" />
        <path d={inv} fill="none" stroke="var(--chart-principal)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        <circle cx={x(n - 1)} cy={y(data[n - 1]?.balance ?? 0)} r={4} fill="var(--chart-gain)" />
      </svg>
      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>Yr 1</span>
        {n > 2 && <span>Yr {Math.floor(n / 2)}</span>}
        <span>Yr {n}</span>
      </div>
      <div className="mt-2 flex gap-4 text-xs">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-chart-gain" />Total balance</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-chart-principal" />Invested</span>
      </div>
    </div>
  );
}
