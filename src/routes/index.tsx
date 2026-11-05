import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarClock, HandCoins, Plane, Plus, ReceiptText, CloudUpload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TabBar } from "@/components/omni/ui";
import { ExpensesTab } from "@/features/finance/ExpensesTab";
import { DebtsTab, SubscriptionsTab, TripsTab } from "@/features/finance/OtherTabs";
import { SubscriptionDialog, TripDialog, TxDialog } from "@/features/finance/dialogs";
import { BackupDialog } from "@/features/finance/BackupDialog";
import { useUi } from "@/lib/ui-store";

const TABS = [
  { id: "EXPENSES", title: "Expenses & Accounts", icon: ReceiptText },
  { id: "SUBSCRIPTIONS", title: "Recurring & Bills", icon: CalendarClock },
  { id: "DEBTS", title: "Lend & Borrow", icon: HandCoins },
  { id: "TRIPS", title: "Trip Manager", icon: Plane },
] as const;
type Tab = (typeof TABS)[number]["id"];

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab | undefined } => ({ tab: TABS.some((t) => t.id === s["tab"]) ? (s["tab"] as Tab) : undefined }),
  head: () => ({
    meta: [
      { title: "OmniCalc — Expenses, Accounts, Bills & Trips" },
      { name: "description", content: "Track expenses and income across bank and cash accounts, monthly budget, recurring bills, lend & borrow and trip budgets — saved on your device." },
      { property: "og:title", content: "OmniCalc — Finance & Money" },
      { property: "og:description", content: "Expenses, bank accounts, budgets, recurring bills, lend & borrow and trip budgets in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FinancePage,
});

function FinancePage() {
  const { tab = "EXPENSES" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const intent = useUi((s) => s.financeIntent);
  const setIntent = useUi((s) => s.setFinanceIntent);
  const [tx, setTx] = useState<{ mode: "EXPENSE" | "INCOME"; trip: number | null } | null>(null);
  const [trip, setTrip] = useState(false);
  const [sub, setSub] = useState(false);
  const [backup, setBackup] = useState(false);

  useEffect(() => {
    if (!intent) return;
    if (intent === "expense") setTx({ mode: "EXPENSE", trip: null });
    if (intent === "income") setTx({ mode: "INCOME", trip: null });
    if (intent === "trip") setTrip(true);
    if (intent === "subscription") setSub(true);
    setIntent(null);
  }, [intent, setIntent]);

  return (
    <>
      <div className="flex items-center justify-between gap-3 py-4">
        <div>
          <h1 className="text-xl font-extrabold">Finance & Money</h1>
          <p className="text-sm text-muted-foreground">Custom categories, bank accounts & trips</p>
        </div>
        <Button variant="tonal" onClick={() => setBackup(true)}><CloudUpload /> Backup / Restore</Button>
      </div>
      <TabBar tabs={[...TABS]} value={tab} onChange={(t) => navigate({ search: { tab: t }, replace: true })} scroll />
      <div className="pt-4">
        {tab === "EXPENSES" && <ExpensesTab onAdd={(mode) => setTx({ mode, trip: null })} />}
        {tab === "SUBSCRIPTIONS" && <SubscriptionsTab onAdd={() => setSub(true)} />}
        {tab === "DEBTS" && <DebtsTab />}
        {tab === "TRIPS" && <TripsTab onAdd={() => setTrip(true)} onLogExpense={(id) => setTx({ mode: "EXPENSE", trip: id })} />}
      </div>

      {tab !== "DEBTS" && (
        <Button
          variant="fab"
          size="fab"
          className="fixed bottom-24 right-5 z-20"
          onClick={() => (tab === "TRIPS" ? setTrip(true) : tab === "SUBSCRIPTIONS" ? setSub(true) : setTx({ mode: "EXPENSE", trip: null }))}
        >
          <Plus className="size-5" />
          {tab === "TRIPS" ? "Add Trip" : tab === "SUBSCRIPTIONS" ? "Add Subscription" : "Log Expense"}
        </Button>
      )}

      <TxDialog mode={tx?.mode ?? "EXPENSE"} open={!!tx} onOpenChange={(o) => !o && setTx(null)} initialTripId={tx?.trip ?? null} />
      <TripDialog open={trip} onOpenChange={setTrip} />
      <SubscriptionDialog open={sub} onOpenChange={setSub} />
      <BackupDialog open={backup} onOpenChange={setBackup} />
    </>
  );
}
