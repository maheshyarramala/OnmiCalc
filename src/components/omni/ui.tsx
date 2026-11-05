import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/settings-store";
import { DECIMAL_INPUT } from "@/lib/format";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function Panel({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-3xl border bg-card p-4 text-card-foreground shadow-soft sm:p-5", className)} {...p} />;
}

export function SectionTitle({ title, subtitle, action, className }: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-lg font-bold leading-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value, tone = "default", icon, className }: { label: React.ReactNode; value: React.ReactNode; tone?: "default" | "income" | "expense" | "warning" | "primary"; icon?: React.ReactNode; className?: string }) {
  const tones = {
    default: "bg-surface-2 text-foreground",
    income: "bg-income-soft text-income",
    expense: "bg-expense-soft text-expense",
    warning: "bg-warning-soft text-warning",
    primary: "bg-primary-soft text-primary",
  } as const;
  return (
    <div className={cn("rounded-2xl p-3", tones[tone], className)}>
      <div className="flex items-center gap-1.5 text-xs font-medium opacity-80">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-base font-bold tabular-nums">{value}</div>
    </div>
  );
}

export function Pill({ children, tone = "muted", className }: { children: React.ReactNode; tone?: "muted" | "primary" | "income" | "expense" | "warning" | "hero"; className?: string }) {
  const tones = {
    muted: "bg-surface-2 text-muted-foreground",
    primary: "bg-primary-soft text-primary",
    income: "bg-income-soft text-income",
    expense: "bg-expense-soft text-expense",
    warning: "bg-warning-soft text-warning",
    hero: "bg-hero-soft text-hero-foreground",
  } as const;
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold", tones[tone], className)}>{children}</span>;
}

export function Chip({ selected, onClick, children, className, icon, color }: { selected?: boolean; onClick?: () => void; children: React.ReactNode; className?: string; icon?: React.ReactNode; color?: string | undefined }) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic();
        onClick?.();
      }}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        selected ? "border-transparent bg-tonal text-tonal-foreground" : "border-border bg-transparent text-foreground hover:bg-surface-2",
        className,
      )}
    >
      {color && <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />}
      {icon}
      {children}
    </button>
  );
}

export function ChipRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1", className)}>{children}</div>;
}

export interface TabDef<T extends string> {
  id: T;
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export function TabBar<T extends string>({ tabs, value, onChange, scroll }: { tabs: TabDef<T>[]; value: T; onChange: (v: T) => void; scroll?: boolean }) {
  return (
    <div className={cn("sticky top-0 z-10 -mx-4 border-b bg-background/95 px-2 backdrop-blur", scroll ? "scrollbar-none overflow-x-auto" : "")}>
      <div className={cn("flex", scroll ? "w-max min-w-full" : "")}>
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = t.id === value;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                haptic();
                onChange(t.id);
              }}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-1 px-3 pb-2.5 pt-3 text-xs font-semibold transition-colors sm:text-sm",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                scroll && "flex-none",
              )}
            >
              {Icon && <Icon className="size-5" />}
              <span className="whitespace-nowrap">{t.title}</span>
              {active && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TextField({ label, value, onChange, placeholder, prefix, suffix, type = "text", className, error, multiline, inputMode, maxLength, autoFocus }: {
  label?: string; value: string; onChange: (v: string) => void; placeholder?: string; prefix?: React.ReactNode; suffix?: React.ReactNode;
  type?: string; className?: string; error?: string | undefined; multiline?: boolean; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]; maxLength?: number; autoFocus?: boolean;
}) {
  const id = React.useId();
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <label htmlFor={id} className="text-sm font-medium text-muted-foreground">{label}</label>}
      <div className={cn("flex items-center gap-2 rounded-2xl border bg-background px-3 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary", error && "border-destructive")}>
        {prefix && <span className="font-bold text-primary">{prefix}</span>}
        {multiline ? (
          <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={4} className="min-h-24 w-full resize-y bg-transparent py-2.5 text-base outline-none placeholder:text-muted-foreground/60" />
        ) : (
          <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode} maxLength={maxLength} autoFocus={autoFocus} className="h-11 w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted-foreground/60" />
        )}
        {suffix && <span className="shrink-0 text-sm text-muted-foreground">{suffix}</span>}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** Numeric field with optional slider and preset chips (NumberInputField.kt). */
export function NumberField({ label, value, onChange, prefix, suffix, slider, presets, onPreset, className }: {
  label: string; value: string; onChange: (v: string) => void; prefix?: string; suffix?: string;
  slider?: { min: number; max: number; step?: number; value: number; onChange: (v: number) => void };
  presets?: [string, number][]; onPreset?: (v: number) => void; className?: string;
}) {
  const id = React.useId();
  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={id} className="text-sm font-medium text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2 rounded-2xl border bg-background px-3 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
        {prefix && <span className="text-lg font-bold text-primary">{prefix}</span>}
        <input
          id={id}
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "" || DECIMAL_INPUT.test(v)) onChange(v);
          }}
          className="h-12 w-full min-w-0 bg-transparent text-lg font-semibold tabular-nums outline-none"
        />
        {suffix && <span className="shrink-0 text-sm text-muted-foreground">{suffix}</span>}
        {value && (
          <button type="button" aria-label="Clear input" onClick={() => onChange("")} className="rounded-full p-1 text-muted-foreground hover:bg-surface-2">
            <X className="size-4" />
          </button>
        )}
      </div>
      {slider && (
        <Slider
          min={slider.min}
          max={slider.max}
          step={slider.step ?? (slider.max - slider.min) / 200}
          value={[Math.min(slider.max, Math.max(slider.min, slider.value))]}
          onValueChange={([v]) => slider.onChange(v ?? slider.min)}
          className="py-1"
        />
      )}
      {presets && (
        <ChipRow>
          {presets.map(([t, v]) => (
            <button key={t} type="button" onClick={() => { haptic(); onPreset?.(v); }} className="shrink-0 rounded-full border px-3 py-1 text-xs font-semibold text-muted-foreground hover:bg-surface-2 hover:text-foreground">
              {t}
            </button>
          ))}
        </ChipRow>
      )}
    </div>
  );
}

export function Modal({ open, onOpenChange, title, description, children, footer, className }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: React.ReactNode; description?: React.ReactNode; children?: React.ReactNode; footer?: React.ReactNode; className?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={className}>
        <DialogHeader className="text-left">
          <DialogTitle className="pr-6 font-display text-lg">{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : <DialogDescription className="sr-only">{typeof title === "string" ? title : "Dialog"}</DialogDescription>}
        </DialogHeader>
        {children}
        {footer && <DialogFooter className="flex-row justify-end gap-2">{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: React.ComponentType<{ className?: string }>; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed bg-card/50 px-6 py-10 text-center">
      <Icon className="size-12 text-muted-foreground/60" />
      <p className="mt-3 font-display text-base font-bold">{title}</p>
      {text && <p className="mt-1 max-w-xs text-sm text-muted-foreground">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Progress({ value, tone = "primary", className }: { value: number; tone?: "primary" | "income" | "expense" | "warning"; className?: string }) {
  const tones = { primary: "bg-primary", income: "bg-income", expense: "bg-expense", warning: "bg-warning" } as const;
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-2", className)}>
      <div className={cn("h-full rounded-full transition-all", tones[tone])} style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} />
    </div>
  );
}

export function Row({ label, value, className, strong }: { label: React.ReactNode; value: React.ReactNode; className?: string; strong?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 py-1.5 text-sm", strong && "font-bold", className)}>
      <span className={cn(!strong && "text-muted-foreground")}>{label}</span>
      <span className="text-right font-semibold tabular-nums">{value}</span>
    </div>
  );
}
