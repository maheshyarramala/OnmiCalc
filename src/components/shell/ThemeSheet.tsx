import { Check, Moon, Monitor, Sun, Smartphone } from "lucide-react";
import { Modal } from "@/components/omni/ui";
import { ACCENTS, HAPTICS, THEME_MODES, useSettings, haptic } from "@/lib/settings-store";
import { useUi } from "@/lib/ui-store";
import { cn } from "@/lib/utils";

const MODE_ICON = { SYSTEM: Monitor, LIGHT: Sun, DARK: Moon, AMOLED: Smartphone } as const;

export function ThemeSheet() {
  const open = useUi((s) => s.sheet === "theme");
  const openSheet = useUi((s) => s.openSheet);
  const s = useSettings();
  return (
    <Modal open={open} onOpenChange={(o) => openSheet(o ? "theme" : null)} title="Personalize Experience" description="Dark modes, accent colors & tactile tuning">
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-sm font-semibold">Theme Mode</p>
          <div className="grid grid-cols-4 gap-2">
            {THEME_MODES.map((m) => {
              const Icon = MODE_ICON[m.id];
              return (
                <button key={m.id} type="button" onClick={() => { haptic(); s.setThemeMode(m.id); }} className={cn("flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-xs font-semibold", s.themeMode === m.id ? "border-primary bg-primary-soft text-primary" : "hover:bg-surface-2")}>
                  <Icon className="size-5" />
                  {m.title}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold">Accent Palette</p>
          <div className="grid grid-cols-3 gap-2">
            {ACCENTS.map((a) => (
              <button key={a.id} type="button" onClick={() => { haptic(); s.setAccent(a.id); }} className={cn("flex items-center gap-2 rounded-2xl border p-2.5 text-left text-xs font-semibold", s.accent === a.id ? "border-primary" : "hover:bg-surface-2")}>
                <span className="grid size-7 shrink-0 place-items-center rounded-full" style={{ background: `linear-gradient(135deg, ${a.light}, ${a.dark})` }}>
                  {s.accent === a.id && <Check className="size-4 text-white" />}
                </span>
                {a.title}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-sm font-semibold">Keypad Haptic Feedback</p>
          <p className="mb-2 text-xs text-muted-foreground">Vibration works on phones that support it.</p>
          <div className="grid grid-cols-3 gap-2">
            {HAPTICS.map((h) => (
              <button key={h.id} type="button" onClick={() => { s.setHaptic(h.id); haptic("long"); }} className={cn("rounded-2xl border p-2.5 text-xs font-semibold", s.haptic === h.id ? "border-primary bg-primary-soft text-primary" : "hover:bg-surface-2")}>
                {h.title}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
