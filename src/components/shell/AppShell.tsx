import { useEffect, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Calculator, Eye, EyeOff, History, Landmark, LayoutGrid, MoreVertical, Palette, PiggyBank, Shapes, TrendingUp } from "lucide-react";
import { useFinance } from "@/lib/finance/store";
import { useHistory } from "@/lib/history-store";
import { useSettings, haptic } from "@/lib/settings-store";
import { useUi } from "@/lib/ui-store";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { HubSheet } from "./HubSheet";
import { HistorySheet, FavoritesSheet } from "./HistorySheets";
import { ThemeSheet } from "./ThemeSheet";
import { AppInfoDialog } from "./AppInfoDialog";

const NAV = [
  { to: "/", label: "Finance", icon: PiggyBank },
  { to: "/emi", label: "EMI", icon: Landmark },
  { to: "/calculator", label: "Calc", icon: Calculator },
  { to: "/invest", label: "Invest", icon: TrendingUp },
  { to: "/utility", label: "Utility", icon: Shapes },
] as const;

function useApplyTheme() {
  const mode = useSettings((s) => s.themeMode);
  const accent = useSettings((s) => s.accent);
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      root.classList.remove("dark", "amoled", "light");
      const resolved = mode === "SYSTEM" ? (mq.matches ? "dark" : "light") : mode.toLowerCase();
      root.classList.add(resolved);
      root.dataset["accent"] = accent;
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [mode, accent]);
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const privacy = useSettings((s) => s.privacy);
  const togglePrivacy = useSettings((s) => s.togglePrivacy);
  const openSheet = useUi((s) => s.openSheet);
  const openInfo = useUi((s) => s.openInfo);

  useEffect(() => {
    void useFinance.persist.rehydrate();
    void useHistory.persist.rehydrate();
    void useSettings.persist.rehydrate();
  }, []);
  useApplyTheme();

  const iconBtn = "grid size-10 place-items-center rounded-full bg-tonal text-tonal-foreground transition hover:opacity-85 sm:size-11";

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col bg-background">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b bg-background/90 px-4 py-3 backdrop-blur">
        <button type="button" onClick={() => openSheet("hub")} className="font-display text-2xl font-extrabold tracking-tight" aria-label="Choose calculator">
          <span className="text-primary">Omni</span>Calc
        </button>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button type="button" className={iconBtn} aria-label={privacy ? "Show amounts" : "Hide amounts"} onClick={() => { haptic("long"); togglePrivacy(); }}>
            {privacy ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
          <button type="button" className={iconBtn} aria-label="Saved history" onClick={() => { haptic("long"); openSheet("history"); }}>
            <History className="size-5" />
          </button>
          <button type="button" className={iconBtn} aria-label="Theme and Customization" onClick={() => { haptic("long"); openSheet("theme"); }}>
            <Palette className="size-5" />
          </button>
          <button type="button" className={iconBtn} aria-label="Choose calculator by icon" onClick={() => { haptic("long"); openSheet("hub"); }}>
            <LayoutGrid className="size-5" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-surface-2" aria-label="More options">
                <MoreVertical className="size-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => openSheet("favorites")}>Favorites</DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/home">Dashboard</Link></DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openInfo("ABOUT")}>About</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openInfo("TERMS")}>Terms & Conditions</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openInfo("PRIVACY")}>Privacy Policy</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openInfo("CONTACT")}>Feedback</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openInfo("CONTACT")}>Contact Us</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openInfo("DONATE")}>Donate</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="flex-1 px-4 pb-32 pt-0">{children}</main>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur" aria-label="Main">
        <div className="mx-auto flex max-w-3xl">
          {NAV.map((n) => {
            const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link key={n.to} to={n.to} onClick={() => haptic()} className="flex flex-1 flex-col items-center gap-1 pb-1.5 pt-2.5">
                <span className={cn("grid h-8 w-14 place-items-center rounded-full transition-colors", active ? "bg-tonal text-tonal-foreground" : "text-muted-foreground")}>
                  <Icon className="size-5" />
                </span>
                <span className={cn("text-xs", active ? "font-bold text-foreground" : "text-muted-foreground")}>{n.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <HubSheet />
      <HistorySheet />
      <FavoritesSheet />
      <ThemeSheet />
      <AppInfoDialog />
    </div>
  );
}
