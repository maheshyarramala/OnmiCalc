import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip, ChipRow, Modal, TextField } from "@/components/omni/ui";
import { useFinance } from "@/lib/finance/store";
import { parseSms, incomeCategoryFor } from "@/lib/finance/sms";
import { WEEKDAYS, MONTHS, dayOfWeek, today } from "@/lib/calc/dates";
import { num } from "@/lib/format";
import type { ExpenseRecord } from "@/lib/finance/types";

const dec = (v: string) => /^\d*\.?\d*$/.test(v);
export const INCOME_CATS = ["Salary", "Freelance", "Business", "Investment", "Bonus", "Gift", "Other"];
export const CAT_COLORS = ["#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899", "#06B6D4", "#6366F1"];

function AccountChips({ value, onChange }: { value: number | null; onChange: (id: number) => void }) {
  const accounts = useFinance((s) => s.bankAccounts);
  return (
    <ChipRow>
      {accounts.map((a) => <Chip key={a.id} selected={value === a.id} onClick={() => onChange(a.id)}>{a.bankName}</Chip>)}
    </ChipRow>
  );
}

/** Log New Expense / Add Income (with paste-SMS auto-fill) */
export function TxDialog({ mode, open, onOpenChange, initialTripId = null }: { mode: "EXPENSE" | "INCOME"; open: boolean; onOpenChange: (o: boolean) => void; initialTripId?: number | null }) {
  const accounts = useFinance((s) => s.bankAccounts);
  const categories = useFinance((s) => s.categories);
  const trips = useFinance((s) => s.trips);
  const addExpense = useFinance((s) => s.addExpense);
  const isIncome = mode === "INCOME";
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [acc, setAcc] = useState<number | null>(null);
  const [cat, setCat] = useState("");
  const [notes, setNotes] = useState("");
  const [trip, setTrip] = useState<number | null>(initialTripId);
  const [sms, setSms] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle(""); setAmount(""); setNotes(""); setSms(null);
      setAcc(accounts[0]?.id ?? null);
      setCat(isIncome ? "Salary" : (categories[0]?.name ?? "General"));
      setTrip(initialTripId);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const applySms = (text: string) => {
    const p = parseSms(text, accounts);
    if (!p) { toast.error(isIncome ? "Copy a bank SMS with an amount, then try again." : "Copy a bank SMS with an amount, then try again."); return; }
    if (p.isIncome !== isIncome) { toast.error(isIncome ? "This SMS looks like an expense. Use Add Expense to record it." : "This SMS looks like income. Use Add Income to record it."); return; }
    setAmount(String(p.amount));
    setTitle(p.merchantOrTitle);
    if (p.matchedAccountId != null) setAcc(p.matchedAccountId);
    setCat(isIncome ? incomeCategoryFor(text) : p.suggestedCategory);
    setNotes(p.rawNotes);
    setSms(null);
    toast.success(isIncome ? "Income details filled from SMS." : "Expense details filled from SMS.");
  };

  const pasteSms = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t.trim()) return applySms(t);
    } catch {
      /* clipboard blocked — fall back to manual paste */
    }
    setSms("");
  };

  const save = () => {
    const a = num(amount);
    if (!title.trim() || !(a > 0)) return;
    const account = accounts.find((x) => x.id === acc);
    addExpense({ title: title.trim(), amount: a, categoryName: cat, type: mode, bankAccountId: account?.id ?? null, bankAccountName: account?.bankName ?? "", notes: notes.trim(), tripId: isIncome ? null : trip });
    toast.success(isIncome ? `Income added to ${account?.bankName ?? "ledger"}!` : "Expense logged successfully!");
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isIncome ? "Add Income" : "Log New Expense"}
      footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={!title.trim() || !(num(amount) > 0)} onClick={save}>{isIncome ? "Save Income" : "Save Expense"}</Button></>}
    >
      {sms === null ? (
        <Button variant="tonal" onClick={pasteSms}><MessageSquareText /> Auto-Fill from SMS</Button>
      ) : (
        <div className="space-y-2 rounded-2xl bg-surface-2 p-3">
          <TextField multiline label="Paste your bank / UPI SMS" value={sms} onChange={setSms} placeholder="Rs.450.00 debited from A/c XX1234 to swiggy@upi..." />
          <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => setSms(null)}>Cancel</Button><Button size="sm" onClick={() => applySms(sms)}>Fill from SMS</Button></div>
        </div>
      )}
      <TextField label={isIncome ? "Income Description" : "Expense Title"} value={title} onChange={setTitle} />
      <TextField label={isIncome ? "Income Amount (₹)" : "Amount (₹)"} prefix="₹" value={amount} onChange={(v) => dec(v) && setAmount(v)} inputMode="decimal" />
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-muted-foreground">{isIncome ? "Deposit into Account:" : "Deduct from Account:"}</p>
        <AccountChips value={acc} onChange={setAcc} />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-muted-foreground">{isIncome ? "Source Category:" : "Category:"}</p>
        <ChipRow>
          {(isIncome ? INCOME_CATS.map((n) => ({ name: n, colorHex: undefined as string | undefined })) : categories).map((c) => (
            <Chip key={c.name} selected={cat === c.name} color={c.colorHex} onClick={() => setCat(c.name)}>{c.name}</Chip>
          ))}
        </ChipRow>
      </div>
      {!isIncome && trips.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-muted-foreground">Link to Trip (Optional):</p>
          <ChipRow>
            <Chip selected={trip === null} onClick={() => setTrip(null)}>None</Chip>
            {trips.map((t) => <Chip key={t.id} selected={trip === t.id} onClick={() => setTrip(t.id)}>{t.tripName}</Chip>)}
          </ChipRow>
        </div>
      )}
      <TextField label="Notes (Optional)" value={notes} onChange={setNotes} />
    </Modal>
  );
}

export function EditTxDialog({ tx, onClose }: { tx: ExpenseRecord | null; onClose: () => void }) {
  const categories = useFinance((s) => s.categories);
  const update = useFinance((s) => s.updateExpense);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState("");
  useEffect(() => {
    if (tx) { setTitle(tx.title); setAmount(String(tx.amount)); setCat(tx.categoryName); }
  }, [tx]);
  const names = Array.from(new Set([...categories.map((c) => c.name), ...(tx?.type === "INCOME" ? INCOME_CATS : []), ...(tx ? [tx.categoryName] : [])]));
  return (
    <Modal
      open={!!tx}
      onOpenChange={(o) => !o && onClose()}
      title="Edit Transaction"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={() => {
        const a = num(amount);
        if (!tx || !title.trim() || !(a > 0) || !cat) { toast.error("Enter a title, valid amount, and category."); return; }
        update(tx.id, { title, amount: a, categoryName: cat });
        toast.success("Transaction updated");
        onClose();
      }}>Update</Button></>}
    >
      <TextField label="Title" value={title} onChange={setTitle} />
      <TextField label="Amount (₹)" prefix="₹" value={amount} onChange={(v) => dec(v) && setAmount(v)} inputMode="decimal" />
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-muted-foreground">Category</span>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="h-11 w-full rounded-2xl border bg-background px-3">
          {names.map((n) => <option key={n}>{n}</option>)}
        </select>
      </label>
    </Modal>
  );
}

export function CategoryDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const add = useFinance((s) => s.addCategory);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(CAT_COLORS[0] ?? "#6366F1");
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Add Custom Category" footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={!name.trim()} onClick={() => { add(name, color); toast.success(`Category '${name.trim()}' added!`); setName(""); onOpenChange(false); }}>Add Category</Button></>}>
      <TextField label="Category Name" placeholder="e.g. Gym, Pets, Groceries" value={name} onChange={setName} />
      <div className="flex flex-wrap gap-2">
        {CAT_COLORS.map((c) => (
          <button key={c} type="button" aria-label={`Color ${c}`} onClick={() => setColor(c)} className="size-9 rounded-full ring-offset-2 ring-offset-card" style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 3px ${c}` : undefined }} />
        ))}
      </div>
    </Modal>
  );
}

const ACCOUNT_TYPES = ["Savings", "Current", "Cash Wallet", "Checking", "Credit Card"];

export function AccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const add = useFinance((s) => s.addBankAccount);
  const [f, setF] = useState({ name: "", opening: "", type: "Savings", number: "", ifsc: "", holder: "", notes: "" });
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Add Bank / Cash Account"
      footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={!f.name.trim()} onClick={() => {
        add({ bankName: f.name, accountType: f.type, accountNumber: f.number.trim(), ifscOrRouting: f.ifsc.trim(), holderName: f.holder.trim(), openingBalance: num(f.opening), notes: f.notes.trim() });
        toast.success(`Account '${f.name.trim()}' added!`);
        setF({ name: "", opening: "", type: "Savings", number: "", ifsc: "", holder: "", notes: "" });
        onOpenChange(false);
      }}>Create Account</Button></>}
    >
      <TextField label="Account / Bank Name *" value={f.name} onChange={(name) => setF({ ...f, name })} />
      <TextField label="Opening Balance (₹) *" prefix="₹" value={f.opening} onChange={(v) => dec(v) && setF({ ...f, opening: v })} inputMode="decimal" />
      <ChipRow>{ACCOUNT_TYPES.map((t) => <Chip key={t} selected={f.type === t} onClick={() => setF({ ...f, type: t })}>{t}</Chip>)}</ChipRow>
      <TextField label="Account Number (Optional)" value={f.number} onChange={(number) => setF({ ...f, number })} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="IFSC / Routing (Optional)" value={f.ifsc} onChange={(ifsc) => setF({ ...f, ifsc })} />
        <TextField label="Holder Name (Optional)" value={f.holder} onChange={(holder) => setF({ ...f, holder })} />
      </div>
      <TextField label="Notes (Optional)" value={f.notes} onChange={(notes) => setF({ ...f, notes })} />
    </Modal>
  );
}

export function TransferDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const accounts = useFinance((s) => s.bankAccounts);
  const transfer = useFinance((s) => s.transfer);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  useEffect(() => {
    if (open) {
      setFrom(String(accounts[0]?.id ?? ""));
      setTo(String(accounts[1]?.id ?? ""));
      setAmount(""); setNotes("");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const sel = "h-11 w-full rounded-2xl border bg-background px-3";
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Transfer Between Accounts"
      description="Transfers are excluded from income, expense, and budget totals."
      footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={() => {
        const r = transfer(Number(from), Number(to), num(amount), notes.trim());
        if (!r.ok) { toast.error(r.message); return; }
        toast.success(r.message);
        onOpenChange(false);
      }}>Transfer</Button></>}
    >
      <label className="block space-y-1.5"><span className="text-sm text-muted-foreground">From:</span>
        <select value={from} onChange={(e) => { setFrom(e.target.value); if (e.target.value === to) setTo(String(accounts.find((a) => String(a.id) !== e.target.value)?.id ?? "")); }} className={sel}>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.bankName}</option>)}
        </select>
      </label>
      <label className="block space-y-1.5"><span className="text-sm text-muted-foreground">To:</span>
        <select value={to} onChange={(e) => setTo(e.target.value)} className={sel}>
          {accounts.filter((a) => String(a.id) !== from).map((a) => <option key={a.id} value={a.id}>{a.bankName}</option>)}
        </select>
      </label>
      <TextField label="Amount" prefix="₹" value={amount} onChange={(v) => dec(v) && setAmount(v)} inputMode="decimal" />
      <TextField label="Notes (Optional)" value={notes} onChange={setNotes} />
    </Modal>
  );
}

export function BudgetDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const limit = useFinance((s) => s.monthlyBudgetLimit);
  const set = useFinance((s) => s.setBudget);
  const [v, setV] = useState("");
  useEffect(() => { if (open) setV(String(Math.trunc(limit || 50000))); }, [open, limit]);
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Monthly Expense Target"
      description="Set your total monthly spending target limit. OmniCalc will track your daily burn and warn you when you cross 80% and 100%."
      footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={!(num(v) > 0)} onClick={() => { set(num(v)); toast.success(`Monthly budget set to ₹${Math.trunc(num(v))}`); onOpenChange(false); }}>Save Target</Button></>}
    >
      <TextField label="Target Monthly Budget" prefix="₹" value={v} onChange={(x) => dec(x) && setV(x)} inputMode="decimal" />
      <ChipRow>{([["₹25k", 25000], ["₹50k", 50000], ["₹75k", 75000], ["₹100k", 100000]] as const).map(([l, n]) => <Chip key={l} selected={num(v) === n} onClick={() => setV(String(n))}>{l}</Chip>)}</ChipRow>
    </Modal>
  );
}

export function TripDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const add = useFinance((s) => s.addTrip);
  const [f, setF] = useState({ name: "", dest: "", budget: "", start: "", end: "", notes: "" });
  const toDmy = (iso: string) => (iso ? iso.split("-").reverse().join("/") : "");
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Create Trip Budget"
      footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={!f.name.trim() || !(num(f.budget) > 0)} onClick={() => {
        add({ tripName: f.name, destination: f.dest.trim(), budget: num(f.budget), startDate: toDmy(f.start), endDate: toDmy(f.end), notes: f.notes.trim() });
        toast.success(`Trip '${f.name.trim()}' created!`);
        setF({ name: "", dest: "", budget: "", start: "", end: "", notes: "" });
        onOpenChange(false);
      }}>Create Trip</Button></>}
    >
      <TextField label="Trip / Vacation Name" value={f.name} onChange={(name) => setF({ ...f, name })} />
      <TextField label="Destination" value={f.dest} onChange={(dest) => setF({ ...f, dest })} />
      <TextField label="Total Budget (₹)" prefix="₹" value={f.budget} onChange={(v) => dec(v) && setF({ ...f, budget: v })} inputMode="decimal" />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Start Date" type="date" value={f.start} onChange={(start) => setF({ ...f, start })} />
        <TextField label="End Date" type="date" value={f.end} onChange={(end) => setF({ ...f, end })} />
      </div>
      <TextField label="Itinerary / Notes (Optional)" value={f.notes} onChange={(notes) => setF({ ...f, notes })} />
    </Modal>
  );
}

export function SubscriptionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const accounts = useFinance((s) => s.bankAccounts);
  const categories = useFinance((s) => s.categories);
  const add = useFinance((s) => s.addSubscription);
  const blank = () => ({ name: "", amount: "", cycle: "MONTHLY", day: "1", weekday: dayOfWeek(today()), month: today().m, cat: categories.find((c) => c.name === "Bills & Utilities")?.name ?? categories[0]?.name ?? "Bills & Utilities", acc: accounts[0]?.id ?? null as number | null, notes: "" });
  const [f, setF] = useState(blank);
  useEffect(() => { if (open) setF(blank()); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Track Recurring Bill"
      footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={!f.name.trim() || !(num(f.amount) > 0)} onClick={() => {
        const a = accounts.find((x) => x.id === f.acc);
        add({ name: f.name, amount: num(f.amount), billingCycle: f.cycle, dueDayOfMonth: parseInt(f.day || "1", 10) || 1, dueMonth: f.month, dueDayOfWeek: f.weekday, categoryName: f.cat, bankAccountId: a?.id ?? null, bankAccountName: a?.bankName ?? "", notes: f.notes.trim() });
        toast.success(`Subscription '${f.name.trim()}' added!`);
        onOpenChange(false);
      }}>Save Bill</Button></>}
    >
      <TextField label="Bill / Service Name" placeholder="e.g. Netflix, Rent, Gym, SIP" value={f.name} onChange={(name) => setF({ ...f, name })} />
      <TextField label="Amount per Cycle" prefix="₹" value={f.amount} onChange={(v) => dec(v) && setF({ ...f, amount: v })} inputMode="decimal" />
      <ChipRow>{["MONTHLY", "WEEKLY", "YEARLY"].map((c) => <Chip key={c} selected={f.cycle === c} onClick={() => setF({ ...f, cycle: c })}>{c[0] + c.slice(1).toLowerCase()}</Chip>)}</ChipRow>
      {f.cycle === "WEEKLY" ? (
        <label className="block space-y-1.5"><span className="text-sm text-muted-foreground">Due weekday</span>
          <select value={f.weekday} onChange={(e) => setF({ ...f, weekday: Number(e.target.value) })} className="h-11 w-full rounded-2xl border bg-background px-3">
            {WEEKDAYS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
          </select>
        </label>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Due Day of Month (1-31)" value={f.day} maxLength={2} onChange={(v) => /^\d*$/.test(v) && setF({ ...f, day: v })} inputMode="numeric" />
          {f.cycle === "YEARLY" && (
            <label className="block space-y-1.5"><span className="text-sm text-muted-foreground">Due month</span>
              <select value={f.month} onChange={(e) => setF({ ...f, month: Number(e.target.value) })} className="h-11 w-full rounded-2xl border bg-background px-3">
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </label>
          )}
        </div>
      )}
      <div className="space-y-1.5"><p className="text-sm text-muted-foreground">Category:</p>
        <ChipRow>{categories.map((c) => <Chip key={c.id} color={c.colorHex} selected={f.cat === c.name} onClick={() => setF({ ...f, cat: c.name })}>{c.name}</Chip>)}</ChipRow>
      </div>
      <div className="space-y-1.5"><p className="text-sm text-muted-foreground">Pay via Account:</p>
        <ChipRow>{accounts.map((a) => <Chip key={a.id} selected={f.acc === a.id} onClick={() => setF({ ...f, acc: a.id })}>{a.bankName}</Chip>)}</ChipRow>
      </div>
      <TextField label="Notes (Optional)" value={f.notes} onChange={(notes) => setF({ ...f, notes })} />
    </Modal>
  );
}
