import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, CircleDashed, CreditCard, Landmark, Home, Car, User, Smartphone, GraduationCap, Plus, Trash2, Undo2, CheckCheck, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip, ChipRow, EmptyState, Modal, Panel, Pill, Progress, Row, TextField } from "@/components/omni/ui";
import { useFinance } from "@/lib/finance/store";
import { accountsWithBalances, loanStats } from "@/lib/finance/logic";
import { calculateLoanPrepayment, standardEmi } from "@/lib/calc/emi";
import { int, money, num } from "@/lib/format";
import type { LoanRecord } from "@/lib/finance/types";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/settings-store";

export const LOAN_CATS = [
  { id: "HOME", label: "Home", icon: Home, color: "#3B82F6" },
  { id: "CAR", label: "Car / Auto", icon: Car, color: "#F59E0B" },
  { id: "PERSONAL", label: "Personal", icon: User, color: "#10B981" },
  { id: "MOBILE", label: "Mobile / Gadget", icon: Smartphone, color: "#8B5CF6" },
  { id: "EDUCATION", label: "Education", icon: GraduationCap, color: "#06B6D4" },
  { id: "OTHER", label: "Other", icon: Landmark, color: "#6366F1" },
] as const;
const catOf = (id: string) => LOAN_CATS.find((c) => c.id === id.toUpperCase()) ?? LOAN_CATS[5];

function usePay() {
  const pay = useFinance((s) => s.payLoanEmi);
  const undo = useFinance((s) => s.undoLoanEmi);
  return (loan: LoanRecord, accountId: number | null) => {
    const r = pay(loan.id, accountId);
    if (!r.ok) { toast.error(r.message); return; }
    haptic("long");
    toast.success(r.message, {
      action: { label: "UNDO", onClick: () => toast(undo(loan.id, r.expenseId).message) },
    });
  };
}

export function LoanTrackerView() {
  const loans = useFinance((s) => s.loans);
  const accounts = useFinance((s) => s.bankAccounts);
  const expenses = useFinance((s) => s.expenses);
  const undo = useFinance((s) => s.undoLoanEmi);
  const [filter, setFilter] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [payFor, setPayFor] = useState<LoanRecord | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const pay = usePay();
  const balances = useMemo(() => accountsWithBalances(accounts, expenses), [accounts, expenses]);

  const summary = useMemo(() => {
    const stats = loans.map((l) => ({ l, s: loanStats(l) }));
    const active = stats.filter((x) => !x.s.isFullyPaid);
    return {
      remaining: active.reduce((a, x) => a + x.s.remainingPrincipal, 0),
      outflow: active.reduce((a, x) => a + x.s.monthlyOutflow, 0),
      paid: stats.reduce((a, x) => a + x.s.principalPaid, 0),
      active: active.length,
    };
  }, [loans]);
  const list = filter ? loans.filter((l) => l.loanCategory.toUpperCase() === filter) : loans;
  const detail = loans.find((l) => l.id === detailId) ?? null;

  return (
    <div className="space-y-4 pt-4">
      <div className="bg-hero rounded-4xl p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="bg-hero-soft grid size-10 place-items-center rounded-full"><Landmark className="size-5" /></span>
            <p className="font-display font-bold">Total Principal Remaining</p>
          </div>
          <Pill tone="hero">{summary.active} Active</Pill>
        </div>
        <p className="mt-3 font-display text-4xl font-extrabold tabular-nums">{money(summary.remaining)}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="bg-hero-tile rounded-2xl p-3">
            <p className="text-xs opacity-80">Monthly EMI Outflow</p>
            <p className="mt-1 font-bold text-expense tabular-nums">{money(summary.outflow)}</p>
          </div>
          <div className="bg-hero-tile rounded-2xl p-3">
            <p className="text-xs opacity-80">Principal Paid</p>
            <p className="mt-1 font-bold text-income tabular-nums">{money(summary.paid)}</p>
          </div>
        </div>
      </div>

      <ChipRow>
        <Chip selected={filter === null} onClick={() => setFilter(null)}>All</Chip>
        {LOAN_CATS.map((c) => (
          <Chip key={c.id} selected={filter === c.id} onClick={() => setFilter(c.id)} icon={<c.icon className="size-4" style={{ color: c.color }} />}>{c.label}</Chip>
        ))}
      </ChipRow>

      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold">{filter ? `${filter} Loans` : "Active & Tracked Loans"}</h2>
        <span className="text-sm text-muted-foreground">{list.length} {list.length === 1 ? "Loan" : "Loans"}</span>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={Landmark} title="No Loans Tracked Yet" text="Tap + to track your Home Loan, Car EMI, or Gadget financing." action={<Button onClick={() => setAdding(true)}>Add Your First Loan</Button>} />
      ) : (
        list.map((l) => {
          const s = loanStats(l);
          const c = catOf(l.loanCategory);
          return (
            <Panel key={l.id} className="cursor-pointer space-y-3" onClick={() => setDetailId(l.id)}>
              <div className="flex items-start gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl" style={{ backgroundColor: `${c.color}22`, color: c.color }}><c.icon className="size-6" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg font-bold">{l.loanName}</p>
                  <ChipRow className="mt-1">
                    <Pill tone={s.isFullyPaid ? "income" : "primary"}>{s.isFullyPaid ? "Closed" : `Active • ${s.remainingEmis} left`}</Pill>
                    <Pill>{l.annualInterestRate}% p.a.</Pill>
                    <Pill>Due day {l.dueDayOfMonth}</Pill>
                    {l.bankAccountName && <Pill>{l.bankAccountName}</Pill>}
                  </ChipRow>
                </div>
                <div className="text-right">
                  <p className="font-bold text-primary tabular-nums">{money(l.emiAmount)}</p>
                  <p className="text-xs text-muted-foreground">/month</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-1.5 font-semibold"><CheckCheck className="size-4 text-primary" />{l.paidEmisCount}/{l.tenureMonths} EMIs Paid</span>
                <Pill>{Math.trunc(s.progress * 100)}% Paid • {s.remainingEmis} EMIs Pending</Pill>
              </div>
              <Progress value={s.progress} tone={s.isFullyPaid ? "income" : "primary"} />
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-income/30 bg-income-soft p-3 text-income">
                  <p className="flex items-center gap-1 text-xs"><CheckCircle2 className="size-3.5" />Principal Paid</p>
                  <p className="mt-1 font-bold tabular-nums">{money(s.principalPaid)}</p>
                </div>
                <div className={cn("rounded-2xl border p-3", s.isFullyPaid ? "border-income/30 bg-income-soft text-income" : "border-expense/30 bg-expense-soft text-expense")}>
                  <p className="flex items-center gap-1 text-xs">{s.isFullyPaid ? <CheckCircle2 className="size-3.5" /> : <CircleDashed className="size-3.5" />}Remaining Principal</p>
                  <p className="mt-1 font-bold tabular-nums">{money(s.remainingPrincipal)}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                {l.paidEmisCount > 0 ? (
                  <Button variant="outline" size="sm" onClick={() => toast(undo(l.id).message)}><Undo2 /> Undo EMI (#{l.paidEmisCount})</Button>
                ) : (
                  <span className="text-sm text-muted-foreground">Tenure: {l.tenureMonths} Mos ({l.startDate})</span>
                )}
                {s.isFullyPaid ? (
                  <Pill tone="income"><CheckCircle2 className="size-3.5" />Loan Fully Closed</Pill>
                ) : (
                  <Button variant="tonal" onClick={() => setPayFor(l)}><CreditCard /> Pay Monthly EMI</Button>
                )}
              </div>
            </Panel>
          );
        })
      )}

      <Button variant="fab" size="round" className="fixed bottom-24 right-5 z-20 size-14 rounded-2xl" aria-label="Add New Loan" onClick={() => setAdding(true)}>
        <Plus className="size-6" />
      </Button>

      <AddLoanDialog open={adding} onOpenChange={setAdding} />

      <Modal open={!!payFor} onOpenChange={(o) => !o && setPayFor(null)} title="Select Account for EMI" description={payFor ? `Choose where to deduct ${money(payFor.emiAmount)}:` : ""} footer={<Button variant="ghost" onClick={() => setPayFor(null)}>Cancel</Button>}>
        {balances.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">No accounts are available. You can still record this EMI without an account.</p>
            <Button variant="outline" onClick={() => { if (payFor) pay(payFor, null); setPayFor(null); }}>Pay without an account</Button>
          </div>
        ) : (
          <div className="space-y-2">
            {balances.map((b) => (
              <button key={b.account.id} type="button" onClick={() => { if (payFor) pay(payFor, b.account.id); setPayFor(null); }} className="flex w-full items-center justify-between rounded-2xl border p-3 text-left hover:bg-surface-2">
                <span className="font-semibold">{b.account.bankName}</span>
                <span className="text-sm text-muted-foreground">Balance: {money(b.currentBalance)}</span>
              </button>
            ))}
          </div>
        )}
      </Modal>

      {detail && <LoanDetail loan={detail} onClose={() => setDetailId(null)} onPay={pay} />}
    </div>
  );
}

function LoanDetail({ loan, onClose, onPay }: { loan: LoanRecord; onClose: () => void; onPay: (l: LoanRecord, a: number | null) => void }) {
  const accounts = useFinance((s) => s.bankAccounts);
  const expenses = useFinance((s) => s.expenses);
  const del = useFinance((s) => s.deleteLoan);
  const undo = useFinance((s) => s.undoLoanEmi);
  const balances = accountsWithBalances(accounts, expenses);
  const s = loanStats(loan);
  const [acc, setAcc] = useState<string>(loan.bankAccountId != null ? String(loan.bankAccountId) : "");
  const [extra, setExtra] = useState("50000");
  const [confirm, setConfirm] = useState(false);
  const sim = calculateLoanPrepayment(s.remainingPrincipal, loan.annualInterestRate, loan.emiAmount, Math.max(loan.tenureMonths - loan.paidEmisCount, 1), num(extra));
  return (
    <>
      <Modal
        open
        onOpenChange={(o) => !o && onClose()}
        title={
          <span className="flex items-center justify-between gap-2">
            {loan.loanName}
            <Button variant="ghost" size="icon" aria-label="Delete Loan" onClick={() => setConfirm(true)}><Trash2 className="text-destructive" /></Button>
          </span>
        }
        footer={
          <div className="flex w-full flex-wrap justify-end gap-2">
            {loan.paidEmisCount > 0 && <Button variant="outline" onClick={() => toast(undo(loan.id).message)}><Undo2 /> Undo #{loan.paidEmisCount}</Button>}
            {!s.isFullyPaid && <Button onClick={() => { onPay(loan, acc ? Number(acc) : null); onClose(); }}>Pay Monthly EMI</Button>}
            <Button variant="ghost" onClick={onClose}>Done</Button>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-2">
          <Row label="Original Principal" value={money(loan.principalAmount)} className="col-span-1 flex-col items-start" />
          <Row label="Interest Rate" value={`${loan.annualInterestRate}% p.a.`} className="flex-col items-start" />
          <Row label="Monthly EMI" value={money(loan.emiAmount)} className="flex-col items-start" />
          <Row label="Tenure" value={`${loan.tenureMonths} Months`} className="flex-col items-start" />
          <Row label="Total Interest Payable" value={money(s.totalInterestPayable)} className="flex-col items-start" />
          <Row label="Total Repayment" value={money(s.totalRepayment)} className="flex-col items-start" />
          <Row label="Principal Paid" value={money(s.principalPaid)} className="flex-col items-start text-income" />
          <Row label="Principal Pending" value={money(s.remainingPrincipal)} className="flex-col items-start text-expense" />
        </div>

        {!s.isFullyPaid && (
          <div className="space-y-3 rounded-2xl bg-surface-2 p-3">
            <div>
              <p className="font-bold">Prepayment & Foreclosure Simulator</p>
              <p className="text-xs text-muted-foreground">Simulate prepaying extra lumpsum towards principal</p>
            </div>
            <ChipRow>
              {([["+ ₹25,000", 25000], ["+ ₹50,000", 50000], ["+ ₹1 Lakh", 100000], ["+ ₹2 Lakhs", 200000]] as const).map(([t, v]) => (
                <Chip key={t} onClick={() => setExtra(String(v))}>{t}</Chip>
              ))}
            </ChipRow>
            <TextField label="Extra Prepayment Amount (₹)" prefix="₹" value={extra} onChange={(v) => /^\d*\.?\d*$/.test(v) && setExtra(v)} inputMode="decimal" />
            {!sim.isValid ? (
              <p className="text-sm text-destructive">Unable to estimate savings because the current EMI does not pay off the remaining balance within the tracked tenure.</p>
            ) : sim.isForeclosed ? (
              <div className="rounded-2xl bg-income-soft p-3 text-income">
                <p className="font-bold">🎉 Loan Fully Foreclosed & Closed!</p>
                <p className="text-sm">You become debt-free immediately and save {money(sim.interestSaved)} in estimated interest!</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-card p-3">
                    <p className="text-xs text-muted-foreground">Tenure Reduced By</p>
                    <p className={cn("font-bold", sim.monthsSaved > 0 && "text-income")}>{sim.monthsSaved} Months</p>
                    <p className="text-xs text-muted-foreground">New tenure: {sim.monthsAfter} mos</p>
                  </div>
                  <div className="rounded-2xl bg-card p-3">
                    <p className="text-xs text-muted-foreground">Total Interest Saved</p>
                    <p className={cn("font-bold", sim.interestSaved > 0 && "text-income")}>{money(sim.interestSaved)}</p>
                    <p className="text-xs text-muted-foreground">Pure direct savings</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Estimate assumes the same EMI and excludes lender prepayment fees or rate changes.</p>
              </>
            )}
          </div>
        )}

        {balances.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-sm font-semibold">Payment & Bank Account</p>
            <label className="text-xs text-muted-foreground">Deduct EMI from</label>
            <select value={acc} onChange={(e) => setAcc(e.target.value)} className="h-11 w-full rounded-2xl border bg-background px-3">
              <option value="">Select payment account</option>
              {balances.map((b) => <option key={b.account.id} value={b.account.id}>{b.account.bankName} - Balance: {money(b.currentBalance)}</option>)}
            </select>
          </div>
        )}
        {loan.notes && <p className="text-sm text-muted-foreground">Notes: {loan.notes}</p>}
      </Modal>
      <Modal
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete Loan?"
        description={`Are you sure you want to delete '${loan.loanName}'? This will remove its tracker history.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { del(loan.id); setConfirm(false); onClose(); toast(`Loan '${loan.loanName}' deleted`); }}>Delete</Button>
          </>
        }
      />
    </>
  );
}

function AddLoanDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const accounts = useFinance((s) => s.bankAccounts);
  const expenses = useFinance((s) => s.expenses);
  const add = useFinance((s) => s.addLoan);
  const balances = accountsWithBalances(accounts, expenses);
  const [name, setName] = useState("");
  const [cat, setCat] = useState("PERSONAL");
  const [p, setP] = useState("");
  const [r, setR] = useState("10.5");
  const [t, setT] = useState("36");
  const [acc, setAcc] = useState<string>("");
  const [paid, setPaid] = useState("0");
  const [due, setDue] = useState("1");
  const [notes, setNotes] = useState("");
  const principal = num(p);
  const tenure = int(t, 0);
  const dueDay = int(due, 0);
  const dueValid = dueDay >= 1 && dueDay <= 31;
  const emi = standardEmi(principal, num(r), tenure);
  const canSave = name.trim() && principal > 0 && tenure > 0 && dueValid;
  const reset = () => { setName(""); setCat("PERSONAL"); setP(""); setR("10.5"); setT("36"); setPaid("0"); setDue("1"); setNotes(""); setAcc(""); };
  const selected = acc || (balances[0] ? String(balances[0].account.id) : "");
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Add Loan or EMI Tracker"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!canSave}
            onClick={() => {
              const a = accounts.find((x) => String(x.id) === selected);
              add({ loanName: name, loanCategory: cat, principalAmount: principal, annualInterestRate: num(r), tenureMonths: tenure, paidEmisCount: int(paid, 0), notes, bankAccountId: a?.id ?? null, bankAccountName: a?.bankName ?? "", dueDayOfMonth: dueDay, emiAmount: emi });
              toast.success(`Loan '${name.trim()}' added successfully`);
              reset();
              onOpenChange(false);
            }}
          >
            Save Loan
          </Button>
        </>
      }
    >
      <TextField label="Loan Name (e.g. HDFC Home Loan, Car EMI)" value={name} onChange={setName} />
      <ChipRow>
        {LOAN_CATS.map((c) => <Chip key={c.id} selected={cat === c.id} onClick={() => setCat(c.id)}>{c.id[0] + c.id.slice(1).toLowerCase()}</Chip>)}
      </ChipRow>
      <TextField label="Principal Amount (₹)" prefix="₹" value={p} onChange={(v) => /^\d*\.?\d*$/.test(v) && setP(v)} inputMode="decimal" />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Interest Rate (% p.a.)" value={r} onChange={(v) => /^\d*\.?\d*$/.test(v) && setR(v)} inputMode="decimal" />
        <TextField label="Tenure (Months)" value={t} onChange={(v) => /^\d*$/.test(v) && setT(v)} inputMode="numeric" />
      </div>
      {balances.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">Deduct EMI from Account</label>
          <select value={selected} onChange={(e) => setAcc(e.target.value)} className="h-11 w-full rounded-2xl border bg-background px-3">
            <option value="">Select Linked Account (Optional)</option>
            {balances.map((b) => <option key={b.account.id} value={b.account.id}>{b.account.bankName} ({money(b.currentBalance)})</option>)}
          </select>
        </div>
      )}
      <TextField label="Already Paid EMIs count (Default 0)" value={paid} onChange={(v) => /^\d*$/.test(v) && setPaid(v)} inputMode="numeric" />
      <TextField label="EMI Due Date (Day of Month, 1-31)" placeholder="e.g. 5 or 10" value={due} maxLength={2} onChange={(v) => /^\d*$/.test(v) && setDue(v)} inputMode="numeric" error={due && !dueValid ? "Enter a day from 1 to 31" : undefined} prefix={<Calendar className="size-4" />} />
      <TextField label="Notes (Account No, Lender name, etc.)" value={notes} onChange={setNotes} />
      {emi > 0 && (
        <div className="flex items-center justify-between rounded-2xl bg-primary-soft p-3">
          <span className="text-sm font-semibold">Calculated Monthly EMI:</span>
          <span className="font-bold text-primary">{money(emi)}</span>
        </div>
      )}
    </Modal>
  );
}
