import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BellRing, CalendarClock, CheckCircle2, ChevronDown, FileDown, HandCoins, Plane, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Chip, ChipRow, EmptyState, Modal, Panel, Pill, Progress, SectionTitle, TabBar, TextField } from "@/components/omni/ui";
import { useFinance } from "@/lib/finance/store";
import { accountsWithBalances, tripStats } from "@/lib/finance/logic";
import { daysBetween, formatLDate, isPaidInCurrentCycle, nextDueDate, today } from "@/lib/calc/dates";
import { formatDayMonYear, formatTimestamp, money, moneyWhole, num } from "@/lib/format";
import { escapeHtml, printReport, shareText } from "@/lib/share";
import type { DebtRecord, SubscriptionRecord, TripRecord } from "@/lib/finance/types";
import { cn } from "@/lib/utils";

// ---------------- Subscriptions ----------------
export function monthlyEquivalent(s: SubscriptionRecord) {
  const c = s.billingCycle.toUpperCase();
  return c === "YEARLY" ? s.amount / 12 : c === "WEEKLY" ? (s.amount * 52) / 12 : s.amount;
}

export function SubscriptionsTab({ onAdd }: { onAdd: () => void }) {
  const subs = useFinance((s) => s.subscriptions);
  const accounts = useFinance((s) => s.bankAccounts);
  const pay = useFinance((s) => s.paySubscription);
  const del = useFinance((s) => s.deleteSubscription);
  const [paying, setPaying] = useState<SubscriptionRecord | null>(null);
  const [acc, setAcc] = useState<number | null>(null);
  const t = today();
  const rows = subs
    .map((s) => ({ s, next: nextDueDate(s, t), paid: isPaidInCurrentCycle(s, t) }))
    .map((x) => ({ ...x, days: daysBetween(t, x.next) }))
    .sort((a, b) => a.days - b.days);
  const total = subs.reduce((a, s) => a + monthlyEquivalent(s), 0);
  return (
    <div className="space-y-4">
      <Panel className="space-y-2">
        <SectionTitle title="Recurring Bills & Subscriptions" subtitle="Track Netflix, Rent, Gym, SIP with due-date countdowns" action={<Button variant="tonal" onClick={onAdd}><Plus /> Add Bill</Button>} />
        <div className="flex items-baseline justify-between rounded-2xl bg-primary-soft p-3"><span className="text-sm">Total Monthly Commitments</span><span className="font-display text-xl font-bold text-primary">{money(total)}</span></div>
      </Panel>
      {rows.length === 0 ? (
        <EmptyState icon={CalendarClock} title="No recurring bills tracked yet" text="Tap '+ Add Bill' to track Netflix, Rent, SIP, WiFi, Gym, etc." />
      ) : (
        rows.map(({ s, next, paid, days }) => {
          const urgent = days >= 0 && days <= 3;
          return (
            <Panel key={s.id} className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-display text-lg font-bold">{s.name}</p>
                  <p className="text-sm text-muted-foreground">{s.categoryName} • {s.billingCycle}{s.bankAccountName ? ` via ${s.bankAccountName}` : ""}</p>
                </div>
                <div className="text-right"><p className="font-bold tabular-nums">{money(s.amount)}</p><p className="text-xs text-muted-foreground">{formatLDate(next)}</p></div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-1.5">
                  {paid && <Pill tone="income">Paid this cycle</Pill>}
                  <Pill tone={urgent ? "warning" : "muted"}>{days === 0 ? "Due Today" : days === 1 ? "Due in 1 day" : `Due in ${days} days`}</Pill>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" aria-label="Delete subscription" onClick={() => { del(s.id); toast(`Subscription '${s.name}' removed`); }}><Trash2 className="text-destructive" /></Button>
                  <Button variant={paid ? "income" : "tonal"} disabled={paid} onClick={() => { setPaying(s); setAcc(s.bankAccountId ?? accounts[0]?.id ?? null); }}>{paid ? <><CheckCircle2 /> Paid</> : "Mark Paid"}</Button>
                </div>
              </div>
            </Panel>
          );
        })
      )}
      <Modal
        open={!!paying}
        onOpenChange={(o) => !o && setPaying(null)}
        title={`Pay Subscription: ${paying?.name ?? ""}`}
        footer={<><Button variant="ghost" onClick={() => setPaying(null)}>Cancel</Button><Button disabled={accounts.length > 0 && acc == null} onClick={() => { if (paying) { const r = pay(paying.id, acc); r.ok ? toast.success(r.message) : toast.error(r.message); } setPaying(null); }}>Confirm Payment</Button></>}
      >
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No accounts are available. The payment will be recorded without an account.</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Select the account or wallet used to pay {money(paying?.amount ?? 0)}:</p>
            <ChipRow>{accounts.map((a) => <Chip key={a.id} selected={acc === a.id} onClick={() => setAcc(a.id)}>{a.bankName}</Chip>)}</ChipRow>
          </>
        )}
      </Modal>
    </div>
  );
}

// ---------------- Debts ----------------
type DebtTab = "LENT" | "BORROWED" | "SETTLED";

function reminderText(d: DebtRecord, upi: string | null) {
  const date = formatDayMonYear(d.dateTimestamp);
  const due = d.dueDateTimestamp ? ` (Due: ${formatDayMonYear(d.dueDateTimestamp)})` : "";
  const amt = moneyWhole(d.amount);
  if (d.type === "LENT") {
    if (upi?.trim()) {
      const link = `upi://pay?pa=${encodeURIComponent(upi)}&pn=OmniCalc&am=${d.amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent("Repayment for Udhaar")}`;
      return `Hi ${d.personName},\n\nFriendly reminder regarding the ${amt} lent on ${date}${due}.\n\n⚡ Pay back instantly in 1-tap via UPI:\n${link}\n\n(Works directly in Google Pay, PhonePe, Paytm, or BHIM)\n\nThank you! 🙏`;
    }
    return `Hi ${d.personName},\n\nThis is a gentle reminder regarding the ${amt} lent on ${date}${due}.\n\nPlease settle it when convenient. Thank you! 🙏`;
  }
  return `Hi ${d.personName},\n\nJust a quick note regarding the ${amt} I borrowed on ${date}${due}. Let me know your preferred UPI ID or payment method to settle this. Thanks! 🙏`;
}

export function DebtsTab() {
  const debts = useFinance((s) => s.debts);
  const upi = useFinance((s) => s.userUpiId);
  const setUpi = useFinance((s) => s.setUpiId);
  const delDebt = useFinance((s) => s.deleteDebt);
  const [tab, setTab] = useState<DebtTab>("LENT");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [settling, setSettling] = useState<DebtRecord | null>(null);
  const [upiDlg, setUpiDlg] = useState(false);
  const [upiVal, setUpiVal] = useState("");
  const lent = debts.filter((d) => d.type === "LENT" && !d.isSettled);
  const borrowed = debts.filter((d) => d.type === "BORROWED" && !d.isSettled);
  const settled = debts.filter((d) => d.isSettled);
  const totalLent = lent.reduce((a, d) => a + d.amount, 0);
  const totalBorrowed = borrowed.reduce((a, d) => a + d.amount, 0);
  const base = tab === "LENT" ? lent : tab === "BORROWED" ? borrowed : settled;
  const list = q.trim() ? base.filter((d) => `${d.personName} ${d.notes}`.toLowerCase().includes(q.trim().toLowerCase())) : base;
  const net = totalLent - totalBorrowed;
  return (
    <div className="space-y-4">
      <div className="bg-hero space-y-3 rounded-4xl p-5">
        <div className="flex items-center justify-between">
          <p className="font-display font-bold">Personal Lend & Borrow</p>
          <Button variant="hero" size="sm" onClick={() => { setUpiVal(upi ?? ""); setUpiDlg(true); }}>Your UPI ID</Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-hero-tile rounded-2xl p-3"><p className="text-xs opacity-80">Total Receivable</p><p className="font-bold text-income">{money(totalLent)}</p></div>
          <div className="bg-hero-tile rounded-2xl p-3"><p className="text-xs opacity-80">Total Payable</p><p className="font-bold text-expense">{money(totalBorrowed)}</p></div>
        </div>
        <Pill tone="hero">Net: {net >= 0 ? "+" : "-"}{money(Math.abs(net))}</Pill>
      </div>
      <TabBar tabs={[{ id: "LENT", title: "People Owe Me" }, { id: "BORROWED", title: "People I Owe" }, { id: "SETTLED", title: "Settled History" }]} value={tab} onChange={setTab} />
      <div className="flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-2xl border bg-background px-3"><Search className="size-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by person or note..." className="h-11 w-full bg-transparent outline-none" />{q && <button type="button" onClick={() => setQ("")} aria-label="Clear search"><X className="size-4" /></button>}</div>
        <Button className="h-11" onClick={() => setAdding(true)}><Plus /> Add</Button>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={HandCoins} title={tab === "SETTLED" ? "No settled records yet" : "No pending records"} text="Tap Add to record money you lent or borrowed." />
      ) : (
        list.map((d) => {
          const isLent = d.type === "LENT";
          const overdue = !d.isSettled && d.dueDateTimestamp != null && d.dueDateTimestamp < Date.now();
          return (
            <Panel key={d.id} className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-lg font-bold">{d.personName}</p>
                  <p className="text-xs text-muted-foreground">{formatDayMonYear(d.dateTimestamp)} • {isLent ? "You lent" : "You borrowed"}{d.bankAccountName ? ` • ${d.bankAccountName}` : ""}</p>
                </div>
                <div className="text-right">
                  <p className={cn("font-bold tabular-nums", isLent ? "text-income" : "text-expense")}>{money(d.amount)}</p>
                  {overdue && <Pill tone="expense">OVERDUE</Pill>}
                  {d.isSettled && <Pill tone="income">Settled</Pill>}
                </div>
              </div>
              {(d.dueDateTimestamp || d.notes) && (
                <div className="text-xs text-muted-foreground">
                  {d.dueDateTimestamp && <p>Due: {formatDayMonYear(d.dueDateTimestamp)}</p>}
                  {d.notes && <p className="italic">“{d.notes}”</p>}
                </div>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="ghost" size="icon" aria-label="Delete record" onClick={() => { delDebt(d.id); toast("Transaction removed"); }}><Trash2 className="text-destructive" /></Button>
                {!d.isSettled && <Button variant="outline" size="sm" onClick={() => shareText(reminderText(d, upi), "Payment Reminder from OmniCalc")}><BellRing /> Reminder</Button>}
                {!d.isSettled && <Button variant="tonal" size="sm" onClick={() => setSettling(d)}><CheckCircle2 /> Settle</Button>}
              </div>
            </Panel>
          );
        })
      )}
      <AddDebtDialog open={adding} onOpenChange={setAdding} />
      <SettleDialog debt={settling} onClose={() => setSettling(null)} />
      <Modal open={upiDlg} onOpenChange={setUpiDlg} title="Your UPI Payment ID" description="Added to LENT reminders so friends can repay in one tap." footer={<><Button variant="ghost" onClick={() => setUpiDlg(false)}>Cancel</Button><Button onClick={() => { setUpi(upiVal.trim() || null); toast.success("UPI ID saved"); setUpiDlg(false); }}>Save UPI ID</Button></>}>
        <TextField label="UPI ID / VPA" placeholder="e.g. yourname@oksbi, 9876543210@paytm" value={upiVal} onChange={setUpiVal} />
      </Modal>
    </div>
  );
}

function AddDebtDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const accounts = useFinance((s) => s.bankAccounts);
  const expenses = useFinance((s) => s.expenses);
  const add = useFinance((s) => s.addDebt);
  const balances = accountsWithBalances(accounts, expenses);
  const [f, setF] = useState({ name: "", amount: "", type: "LENT", due: "", notes: "", acc: "", adjust: true });
  const accId = f.acc || String(accounts[0]?.id ?? "");
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Add Lend / Borrow Transaction"
      footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={!f.name.trim() || !(num(f.amount) > 0)} onClick={() => {
        const a = accounts.find((x) => String(x.id) === accId);
        add({ personName: f.name, amount: num(f.amount), type: f.type, dueDateTimestamp: f.due ? new Date(`${f.due}T12:00:00`).getTime() : null, notes: f.notes.trim(), bankAccountId: a?.id ?? null, bankAccountName: a?.bankName ?? "" }, f.adjust && !!a);
        toast.success(`Transaction with ${f.name.trim()} saved successfully`);
        setF({ name: "", amount: "", type: "LENT", due: "", notes: "", acc: "", adjust: true });
        onOpenChange(false);
      }}>Save Record</Button></>}
    >
      <div className="grid grid-cols-2 gap-2">
        {([["LENT", "I Gave (Lent)"], ["BORROWED", "I Took (Borrowed)"]] as const).map(([v, l]) => (
          <button key={v} type="button" onClick={() => setF({ ...f, type: v })} className={cn("rounded-2xl border p-3 text-sm font-semibold", f.type === v ? (v === "LENT" ? "border-income bg-income-soft text-income" : "border-expense bg-expense-soft text-expense") : "hover:bg-surface-2")}>{l}</button>
        ))}
      </div>
      <TextField label="Person Name (e.g. Rahul, Priya)" value={f.name} onChange={(name) => setF({ ...f, name })} />
      <TextField label="Amount (₹)" prefix="₹" value={f.amount} onChange={(v) => /^\d*\.?\d*$/.test(v) && setF({ ...f, amount: v })} inputMode="decimal" />
      <TextField label="Due Date (Optional)" type="date" value={f.due} onChange={(due) => setF({ ...f, due })} />
      <TextField label="Notes (Reason, split item, etc.)" value={f.notes} onChange={(notes) => setF({ ...f, notes })} />
      {balances.length > 0 && (
        <>
          <label className="block space-y-1.5"><span className="text-sm text-muted-foreground">Bank / Wallet Account</span>
            <select value={accId} onChange={(e) => setF({ ...f, acc: e.target.value })} className="h-11 w-full rounded-2xl border bg-background px-3">
              {balances.map((b) => <option key={b.account.id} value={b.account.id}>{b.account.bankName} ({money(b.currentBalance)})</option>)}
            </select>
          </label>
          <div className="flex items-center justify-between rounded-2xl bg-surface-2 p-3"><span className="text-sm">Record in Finance Hub & Adjust Bank Balance</span><Switch checked={f.adjust} onCheckedChange={(adjust) => setF({ ...f, adjust })} /></div>
        </>
      )}
    </Modal>
  );
}

function SettleDialog({ debt, onClose }: { debt: DebtRecord | null; onClose: () => void }) {
  const accounts = useFinance((s) => s.bankAccounts);
  const settle = useFinance((s) => s.settleDebt);
  const [acc, setAcc] = useState<string>("");
  const [adjust, setAdjust] = useState(true);
  const accId = acc || String(debt?.bankAccountId ?? accounts[0]?.id ?? "");
  return (
    <Modal
      open={!!debt}
      onOpenChange={(o) => !o && onClose()}
      title="Settle Debt?"
      description={debt ? `${debt.type === "LENT" ? `${debt.personName} repaid you` : `You repaid ${debt.personName}`} ${money(debt.amount)}.` : ""}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={() => { if (debt) { const r = settle(debt.id, accId ? Number(accId) : null, adjust); toast.success(r.message); } onClose(); }}>Mark as Settled</Button></>}
    >
      {accounts.length > 0 && (
        <>
          <label className="block space-y-1.5"><span className="text-sm text-muted-foreground">Account</span>
            <select value={accId} onChange={(e) => setAcc(e.target.value)} className="h-11 w-full rounded-2xl border bg-background px-3">
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.bankName}</option>)}
            </select>
          </label>
          <div className="flex items-center justify-between rounded-2xl bg-surface-2 p-3"><span className="text-sm">Record in Finance Hub & Adjust Bank Balance</span><Switch checked={adjust} onCheckedChange={setAdjust} /></div>
        </>
      )}
    </Modal>
  );
}

// ---------------- Trips ----------------
export function TripsTab({ onAdd, onLogExpense }: { onAdd: () => void; onLogExpense: (tripId: number) => void }) {
  const trips = useFinance((s) => s.trips);
  return (
    <div className="space-y-4">
      <Panel>
        <SectionTitle title="Trip & Vacation Budgets" subtitle="Set category caps, track live daily burn rate, and export PDF statements." action={<Button variant="tonal" onClick={onAdd}><Plus /> Trip</Button>} />
      </Panel>
      {trips.length === 0 ? (
        <EmptyState icon={Plane} title="No trips created yet" text="Tap the + trip button to plan your next vacation budget" />
      ) : (
        trips.map((t) => <TripCard key={t.id} trip={t} onLogExpense={() => onLogExpense(t.id)} />)
      )}
    </div>
  );
}

function TripCard({ trip, onLogExpense }: { trip: TripRecord; onLogExpense: () => void }) {
  const expenses = useFinance((s) => s.expenses);
  const categories = useFinance((s) => s.categories);
  const del = useFinance((s) => s.deleteTrip);
  const setCap = useFinance((s) => s.setTripCap);
  const removeCap = useFinance((s) => s.removeTripCap);
  const st = useMemo(() => tripStats(trip, expenses), [trip, expenses]);
  const [capDlg, setCapDlg] = useState(false);
  const [capCat, setCapCat] = useState("");
  const [capVal, setCapVal] = useState("");
  const [ledger, setLedger] = useState(false);
  const gaugeTone = st.burn > 1.05 ? "expense" : st.burn > 0.8 ? "warning" : "income";

  const exportPdf = () => {
    const rows = st.tripExpenses.map((e) => `<tr><td>${escapeHtml(e.title)}</td><td>${escapeHtml(e.categoryName)}</td><td>${formatTimestamp(e.dateTimestamp)}</td><td>${escapeHtml(money(e.amount))}</td></tr>`).join("");
    printReport(`${trip.tripName} - Trip Statement`, `<h1>${escapeHtml(trip.tripName)}</h1><p class="muted">${escapeHtml(trip.destination)} · ${escapeHtml(trip.startDate)} - ${escapeHtml(trip.endDate)}</p>
      <div class="grid"><div class="box">Total Budget<b>${escapeHtml(money(trip.budget))}</b></div><div class="box">Spent<b>${escapeHtml(money(st.spent))}</b></div>
      <div class="box">${st.over ? "Over Budget" : "Remaining"}<b>${escapeHtml(money(Math.abs(trip.budget - st.spent)))}</b></div><div class="box">Daily Rate<b>${escapeHtml(money(st.dailyRate))}/day</b></div></div>
      ${st.capRows.length ? `<h2>Category Caps</h2><table><tr><th>Category</th><th>Spent</th><th>Cap</th></tr>${st.capRows.map((c) => `<tr><td>${escapeHtml(c.category)}</td><td>${escapeHtml(money(c.spent))}</td><td>${escapeHtml(money(c.cap))}</td></tr>`).join("")}</table>` : ""}
      <h2>Expense Ledger</h2><table><tr><th>Title</th><th>Category</th><th>Date</th><th>Amount</th></tr>${rows || '<tr><td colspan="4">No expenses</td></tr>'}</table>`);
  };

  return (
    <Panel className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-lg font-bold">{trip.tripName}</p>
          <p className="text-sm text-muted-foreground">{trip.destination}{(trip.startDate || trip.endDate) && ` · ${trip.startDate} - ${trip.endDate}`}</p>
        </div>
        <div className="text-right"><p className="text-xs text-muted-foreground">Total Cap: {moneyWhole(trip.budget)}</p><p className="text-xs font-semibold">{Math.trunc(st.progress * 100)}% utilized</p></div>
      </div>
      <div className={cn("rounded-2xl p-3", st.over ? "bg-expense-soft text-expense" : "bg-income-soft text-income")}>
        <p className="text-xs font-bold tracking-wider">{st.over ? "OVER BUDGET" : "REMAINING BUDGET"}</p>
        <p className="font-display text-2xl font-extrabold">{money(st.over ? st.spent - trip.budget : trip.budget - st.spent)}</p>
      </div>
      <div className="flex justify-between text-xs text-muted-foreground"><span>Spent: {money(st.spent)}</span><span>Budget: {money(trip.budget)}</span></div>
      <Progress value={st.progress} tone={st.over ? "expense" : "primary"} />
      <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
        <svg viewBox="0 0 100 56" className="h-12 w-20 shrink-0">
          <path d="M8 50 A42 42 0 0 1 92 50" fill="none" stroke="var(--border)" strokeWidth="9" strokeLinecap="round" />
          <path d="M8 50 A42 42 0 0 1 92 50" fill="none" stroke={`var(--${gaugeTone})`} strokeWidth="9" strokeLinecap="round" pathLength={100} strokeDasharray={`${(Math.min(1.5, Math.max(0, st.burn)) / 1.5) * 100} 100`} />
        </svg>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2"><p className="text-sm font-bold">Daily Burn Rate Tracker</p><Pill tone={st.exceeding ? "expense" : "income"}>{st.exceeding ? "Exceeding Daily Rate" : "On Track"}</Pill></div>
          <p className="text-sm">You are spending {money(st.dailyRate)}/day</p>
          <p className="text-xs text-muted-foreground">(Target Budget: {money(st.dailyBudget)}/day • Day {st.elapsed} of {st.totalDays})</p>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between"><p className="text-sm font-bold">Category Budget Caps</p><Button variant="link" size="sm" onClick={() => { setCapCat(categories[0]?.name ?? ""); setCapVal(""); setCapDlg(true); }}>+ Set Sub-Budget</Button></div>
        {st.capRows.length === 0 ? (
          <p className="text-xs text-muted-foreground">No sub-budgets set yet (e.g. Flights ₹20k, Hotels ₹15k, Food ₹10k)</p>
        ) : (
          st.capRows.map((c) => (
            <div key={c.category} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span>{c.category}</span>
                <span className="flex items-center gap-1"><span className={cn(c.over && "text-expense")}>{moneyWhole(c.spent)} / {moneyWhole(c.cap)}</span><button type="button" aria-label="Remove cap" onClick={() => removeCap(trip.id, c.category)}><X className="size-3.5" /></button></span>
              </div>
              <Progress value={c.cap > 0 ? c.spent / c.cap : 0} tone={c.over ? "expense" : "primary"} />
            </div>
          ))
        )}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" size="icon" aria-label="Delete trip" onClick={() => { del(trip.id); toast("Trip removed"); }}><Trash2 className="text-destructive" /></Button>
        <Button variant="outline" size="sm" onClick={exportPdf}><FileDown /> Export PDF</Button>
        <Button variant="tonal" size="sm" onClick={onLogExpense}><Plus /> Log Expense</Button>
      </div>
      <button type="button" onClick={() => setLedger(!ledger)} className="flex w-full items-center justify-between rounded-2xl bg-surface-2 px-3 py-2 text-sm font-semibold">
        Trip Expense Ledger ({st.tripExpenses.length} items)<ChevronDown className={cn("size-4 transition", ledger && "rotate-180")} />
      </button>
      {ledger && (st.tripExpenses.length === 0 ? (
        <p className="text-xs text-muted-foreground">No expenses logged for this trip yet. Tap '+ Log Expense' to record hotel, flight, or meal costs.</p>
      ) : (
        <div className="divide-y">
          {st.tripExpenses.map((e) => (
            <div key={e.id} className="flex justify-between py-1.5 text-sm"><span>{e.title} <span className="text-xs text-muted-foreground">· {e.categoryName}</span></span><span className="font-semibold">{money(e.amount)}</span></div>
          ))}
        </div>
      ))}
      <Modal open={capDlg} onOpenChange={setCapDlg} title="Set Sub-Budget Cap" description={`Set a specific category budget ceiling inside '${trip.tripName}'.`} footer={<><Button variant="ghost" onClick={() => setCapDlg(false)}>Cancel</Button><Button disabled={!(num(capVal) > 0) || !capCat} onClick={() => { setCap(trip.id, capCat, num(capVal)); toast.success(`Cap set for ${capCat}`); setCapDlg(false); }}>Set Cap</Button></>}>
        <ChipRow>{categories.map((c) => <Chip key={c.id} color={c.colorHex} selected={capCat === c.name} onClick={() => setCapCat(c.name)}>{c.name}</Chip>)}</ChipRow>
        <TextField label="Sub-Budget Ceiling" prefix="₹" value={capVal} onChange={(v) => /^\d*\.?\d*$/.test(v) && setCapVal(v)} inputMode="decimal" />
      </Modal>
    </Panel>
  );
}
