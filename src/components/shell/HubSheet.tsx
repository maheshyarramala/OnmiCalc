import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Cake, CalendarDays, Calculator, Landmark, Percent, Plane, ReceiptText, Repeat2, Ruler, Search, Users, Wallet, Banknote, TrendingUp, X, PiggyBank } from "lucide-react";
import { Modal } from "@/components/omni/ui";
import { useUi } from "@/lib/ui-store";
import { haptic } from "@/lib/settings-store";

type Item = { title: string; subtitle: string; icon: React.ComponentType<{ className?: string }>; color: string; to: string; tab?: string };

const ITEMS: Item[] = [
  { title: "Loan & EMI", subtitle: "Amortization & Payoff", icon: Landmark, color: "#4F46E5", to: "/emi" },
  { title: "Interest Calc", subtitle: "All 5 Interest Methods", icon: Percent, color: "#8B5CF6", to: "/interest" },
  { title: "SIP & Growth", subtitle: "Wealth compounding", icon: TrendingUp, color: "#10B981", to: "/invest", tab: "SIP" },
  { title: "Lump Sum", subtitle: "One-time investment", icon: Banknote, color: "#3B82F6", to: "/invest", tab: "LUMPSUM" },
  { title: "Expenses & Accounts", subtitle: "Budget & bank balances", icon: PiggyBank, color: "#10B981", to: "/", tab: "EXPENSES" },
  { title: "Lend & Borrow", subtitle: "Udhaar & personal debt ledger", icon: Repeat2, color: "#059669", to: "/", tab: "DEBTS" },
  { title: "Trip Manager", subtitle: "Vacation budgets & caps", icon: Plane, color: "#0D9488", to: "/", tab: "TRIPS" },
  { title: "Age Calculator", subtitle: "Exact age & birthday", icon: Cake, color: "#F43F5E", to: "/age-calendar", tab: "AGE" },
  { title: "Calendar Date", subtitle: "Difference & add days", icon: CalendarDays, color: "#0EA5E9", to: "/age-calendar", tab: "DATE_DIFF" },
  { title: "Calculator", subtitle: "Scientific & Basic", icon: Calculator, color: "#7C3AED", to: "/calculator" },
  { title: "Currency", subtitle: "Accurate Live Rates", icon: Wallet, color: "#D97706", to: "/utility", tab: "CURRENCY" },
  { title: "Split Bill", subtitle: "Group expense share", icon: Users, color: "#EC4899", to: "/utility", tab: "TIP_SPLIT" },
  { title: "Unit Converter", subtitle: "Length, weight, temp", icon: Ruler, color: "#059669", to: "/utility", tab: "UNIT_CONVERTER" },
  { title: "GST & Tax", subtitle: "Inclusive & exclusive", icon: ReceiptText, color: "#6366F1", to: "/utility", tab: "GST_TAX" },
];

export function HubSheet() {
  const open = useUi((s) => s.sheet === "hub");
  const openSheet = useUi((s) => s.openSheet);
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const list = q.trim() ? ITEMS.filter((i) => `${i.title} ${i.subtitle}`.toLowerCase().includes(q.trim().toLowerCase())) : ITEMS;
  return (
    <Modal open={open} onOpenChange={(o) => openSheet(o ? "hub" : null)} title="Choose Calculator" description="Tap any icon to open directly">
      <div className="flex items-center gap-2 rounded-2xl border bg-background px-3">
        <Search className="size-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name (tax, car, currency, age...)" className="h-11 w-full bg-transparent outline-none" />
        {q && <button type="button" aria-label="Clear search" onClick={() => setQ("")}><X className="size-4" /></button>}
      </div>
      {list.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No calculator matching "{q}"</p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {list.map((i) => (
            <button
              key={i.title}
              type="button"
              onClick={() => {
                haptic();
                openSheet(null);
                void navigate({ href: i.tab ? `${i.to}?tab=${i.tab}` : i.to });
              }}
              className="flex flex-col items-center gap-2 rounded-2xl p-2 text-center hover:bg-surface-2"
            >
              <span className="grid size-14 place-items-center rounded-2xl" style={{ backgroundColor: `${i.color}22`, color: i.color }}>
                <i.icon className="size-6" />
              </span>
              <span className="text-xs font-bold leading-tight">{i.title}</span>
              <span className="text-[10px] leading-tight text-muted-foreground">{i.subtitle}</span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
