import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Calculator, CreditCard, Landmark, LayoutGrid, Minus, Plane, Plus, Repeat, TrendingUp, Users, Wallet, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, Pill, Progress } from "@/components/omni/ui";
import { useFinance } from "@/lib/finance/store";
import { accountsWithBalances, budgetStatus, currentMonthExpenses, isCreditCard, totalExpense, totalIncome, tripStats } from "@/lib/finance/logic";
import { daysBetween, isPaidInCurrentCycle, MONTHS, nextDueDate, today, WEEKDAYS, dayOfWeek, toEpochDay } from "@/lib/calc/dates";
import { money, moneyWhole } from "@/lib/format";
import { useUi } from "@/lib/ui-store";
import { CardReminderDialog, cardStatus } from "@/features/finance/CardReminderDialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "Omni Dashboard — OmniCalc" },
      { name: "description", content: "Your money at a glance: net balance, monthly budget, card bills, trips, upcoming bills and quick calculators." },
      { property: "og:title", content: "Omni Dashboard — OmniCalc" },
      { property: "og:description", content: "Net balance, budget, bills and quick calculators at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const s = useFinance();
  const navigate = useNavigate();
  const setIntent = useUi((x) => x.setFinanceIntent);
  const [card, setCard] = useState<{ open: boolean; id: number | null }>({ open: false, id: null });
  const balances = useMemo(() => accountsWithBalances(s.bankAccounts, s.expenses), [s.bankAccounts, s.expenses]);
  const net = balances.reduce((a, b) => a + b.currentBalance, 0);
  const month = currentMonthExpenses(s.expenses);
  const bud = budgetStatus(month, s.monthlyBudgetLimit);
  const t = today();
  const cards = s.bankAccounts.filter(isCreditCard);
  const reminders = s.creditCardReminders.filter((r) => cards.some((c) => c.id === r.accountId)).sort((a, b) => a.dueDateEpochDay - b.dueDateEpochDay);
  const trip = s.trips[0];
  const ts = trip ? tripStats(trip, s.expenses) : null;
  const nextSub = s.subscriptions.map((x) => ({ x, d: nextDueDate(x, t) })).sort((a, b) => toEpochDay(a.d) - toEpochDay(b.d))[0];

  const go = (to: string, tab?: string, intent?: Parameters<typeof setIntent>[0]) => {
    if (intent) setIntent(intent);
    void navigate({ href: tab ? `${to}?tab=${tab}` : to });
  };

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-extrabold">Omni Dashboard</h1><p className="text-sm text-muted-foreground">{WEEKDAYS[dayOfWeek(t) - 1]}, {String(t.d).padStart(2, "0")} {MONTHS[t.m - 1]}</p></div>
        <LayoutGrid className="size-7 text-primary" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Button variant="expense" className="h-12" onClick={() => go("/", "EXPENSES", "expense")}><Minus /> Log Expense</Button>
        <Button variant="income" className="h-12" onClick={() => go("/", "EXPENSES", "income")}><Plus /> Add Income</Button>
        <Button variant="soft" className="h-12" onClick={() => go("/utility", "TIP_SPLIT")}><Users /> Split Bill</Button>
      </div>

      <button type="button" onClick={() => go("/", "EXPENSES")} className="bg-hero block w-full space-y-3 rounded-4xl p-5 text-left">
        <div className="flex justify-between"><p className="text-sm font-bold opacity-90">Total Net Balance</p><Pill tone="hero">{balances.length} {balances.length === 1 ? "Account" : "Accounts"}</Pill></div>
        <p className="font-display text-4xl font-extrabold tabular-nums">{money(net)}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-hero-tile rounded-2xl p-3"><p className="text-xs opacity-80">Total Inflow</p><p className="font-bold text-income">+{money(totalIncome(s.expenses))}</p></div>
          <div className="bg-hero-tile rounded-2xl p-3"><p className="text-xs opacity-80">Total Spent</p><p className="font-bold text-expense">-{money(totalExpense(s.expenses))}</p></div>
        </div>
      </button>

      <Panel className="cursor-pointer space-y-2" onClick={() => go("/", "EXPENSES")}>
        <div className="flex items-center justify-between"><p className="font-display font-bold">Monthly Budget</p>{bud.over100 ? <Pill tone="expense">Over Budget</Pill> : bud.over80 ? <Pill tone="warning">80%+ Alert</Pill> : null}</div>
        <p className="font-display text-2xl font-extrabold">{money(month)}</p>
        <p className="text-sm text-muted-foreground">of {money(s.monthlyBudgetLimit)} target · {bud.percent}% utilized</p>
        <Progress value={bud.progress} tone={bud.over100 ? "expense" : bud.over80 ? "warning" : "income"} />
      </Panel>

      <Panel className="space-y-2">
        <p className="flex items-center gap-2 font-display font-bold"><CreditCard className="size-5 text-primary" />Credit card due dates</p>
        {cards.length === 0 ? (
          <div className="flex items-center justify-between gap-2"><p className="text-sm text-muted-foreground">Add a credit card in Finance to track its payment due date.</p><Button size="sm" variant="tonal" onClick={() => go("/", "EXPENSES")}>Add a credit card</Button></div>
        ) : reminders.length === 0 ? (
          <div className="flex items-center justify-between gap-2"><p className="text-sm text-muted-foreground">Payment reminders for your credit cards</p><Button size="sm" variant="tonal" onClick={() => setCard({ open: true, id: null })}>Add due date</Button></div>
        ) : (
          <>
            {reminders.slice(0, 2).map((r) => {
              const st = cardStatus(r);
              const name = cards.find((c) => c.id === r.accountId)?.bankName ?? "";
              return (
                <div key={r.accountId} className="flex items-center gap-2 rounded-2xl bg-surface-2 p-3">
                  <div className="min-w-0 flex-1"><p className="font-semibold">{name}</p><p className={cn("text-xs", st.tone === "income" ? "text-income" : st.tone === "expense" ? "text-expense" : "text-primary")}>{st.label}</p></div>
                  <p className="font-bold">{money(r.amount)}</p>
                  <Button variant="ghost" size="icon" aria-label="Edit reminder" onClick={() => setCard({ open: true, id: r.accountId })}><Pencil /></Button>
                  {!st.paid && <Button size="sm" variant="tonal" onClick={() => { s.markCardPaid(r.accountId); toast.success("Credit card bill marked as paid"); }}>Mark paid</Button>}
                </div>
              );
            })}
            {cards.some((c) => !reminders.some((r) => r.accountId === c.id)) && <Button variant="link" size="sm" onClick={() => setCard({ open: true, id: null })}>Add another card due date</Button>}
          </>
        )}
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2">
        <Panel className="cursor-pointer space-y-2" onClick={() => (trip ? go("/", "TRIPS") : go("/", "TRIPS", "trip"))}>
          <p className="flex items-center gap-2 font-display font-bold"><Plane className="size-5 text-primary" />Trip Manager</p>
          {trip && ts ? (
            <>
              <p className="font-semibold">{trip.tripName}</p>
              <p className="text-sm">{money(ts.dailyRate)}/day</p>
              <p className="text-xs text-muted-foreground">Budget: {money(ts.dailyBudget)}/day</p>
              <Pill tone={ts.burn > 1 ? "expense" : "income"}>{ts.burn > 1 ? "Pacing High" : "On Track"}</Pill>
            </>
          ) : (
            <><p className="text-sm text-muted-foreground">No active trip</p><p className="font-semibold text-primary">+ Plan Vacation</p></>
          )}
        </Panel>
        <Panel className="cursor-pointer space-y-2" onClick={() => go("/", "SUBSCRIPTIONS", nextSub ? undefined : "subscription")}>
          <div className="flex items-center justify-between"><p className="flex items-center gap-2 font-display font-bold"><Repeat className="size-5 text-primary" />Recurring Bills</p><Pill>{s.subscriptions.length} Bills</Pill></div>
          {nextSub ? (() => {
            const days = daysBetween(t, nextSub.d);
            const paid = isPaidInCurrentCycle(nextSub.x, t);
            const due = days === 0 ? "Due Today" : days === 1 ? "Due in 1 day" : `Due in ${days} days`;
            return (
              <>
                <p className="text-xs text-muted-foreground">Next Upcoming Bill</p>
                <div className="flex items-center justify-between gap-2">
                  <div><p className="font-semibold">{nextSub.x.name}</p><p className="text-xs text-muted-foreground">{paid ? `Paid this cycle · ${due}` : due}</p></div>
                  <div className="text-right" onClick={(e) => e.stopPropagation()}>
                    <p className="font-bold">{money(nextSub.x.amount)}</p>
                    <Button size="sm" variant="tonal" disabled={paid} onClick={() => { const r = s.paySubscription(nextSub.x.id, nextSub.x.bankAccountId ?? s.bankAccounts[0]?.id ?? null); toast.success(r.message); }}>{paid ? "Paid" : "Pay"}</Button>
                  </div>
                </div>
              </>
            );
          })() : (
            <><p className="text-sm text-muted-foreground">Track Netflix, Rent, SIP</p><p className="font-semibold text-primary">+ Add Subscription</p></>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {([
          { to: "/emi", icon: Landmark, title: "Loan & EMI Calc", sub: "Home, Car & Personal", ex: "₹10L @ 8.5% = ₹12,399/m", cta: "Compute Amortization →" },
          { to: "/utility", tab: "TIP_SPLIT", icon: Users, title: "Split Bill & Tip", sub: "Itemized & Receipt Import", ex: "UPI Settlement", cta: "Start Group Split →" },
          { to: "/utility", tab: "CURRENCY", icon: Wallet, title: "Currency", sub: "USD, EUR, INR, GBP, AED", ex: "18 currencies", cta: "Convert Currencies →" },
          { to: "/invest", icon: TrendingUp, title: "SIP & Wealth", sub: "Compound Interest & Goals", ex: "₹5,000/m @ 12% in 15 yrs", cta: "Plan Wealth Growth →" },
          { to: "/calculator", icon: Calculator, title: "Calculator", sub: "Scientific & Basic with History", ex: "Trigonometry & Logs", cta: "Open Calculator →" },
        ] as const).map((c) => (
          <Link key={c.title} to={c.to} search={"tab" in c ? { tab: c.tab } : {}} className="space-y-1 rounded-3xl border bg-card p-4 hover:border-primary">
            <c.icon className="size-6 text-primary" />
            <p className="font-display font-bold">{c.title}</p>
            <p className="text-xs text-muted-foreground">{c.sub}</p>
            <p className="text-xs font-semibold">{c.ex}</p>
            <p className="text-xs font-bold text-primary">{c.cta}</p>
          </Link>
        ))}
        <Link to="/" className="flex flex-col justify-center rounded-3xl border border-dashed p-4 text-center text-sm font-semibold text-muted-foreground hover:text-foreground">{moneyWhole(net)}<span className="text-xs font-normal">Open Finance</span></Link>
      </div>
      <CardReminderDialog open={card.open} accountId={card.id} onOpenChange={(o) => setCard({ open: o, id: o ? card.id : null })} />
    </div>
  );
}
