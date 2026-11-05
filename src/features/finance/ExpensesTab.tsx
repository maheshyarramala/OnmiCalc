import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowLeftRight, ArrowUp, CreditCard, Gauge, Landmark, MessageSquareText, Minus, Pencil, Plus, ReceiptText, Tags, Trash2, Wallet, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Donut } from "@/components/omni/charts";
import { Chip, ChipRow, EmptyState, Modal, Panel, Pill, Progress, Row, SectionTitle, TextField } from "@/components/omni/ui";
import { useFinance } from "@/lib/finance/store";
import { accountsWithBalances, budgetStatus, currentMonthCategorySpend, currentMonthExpenses, findLinkedTransfers, isCreditCard, totalExpense, totalIncome } from "@/lib/finance/logic";
import { parseSms } from "@/lib/finance/sms";
import { formatTimestamp, money, moneyWhole, num } from "@/lib/format";
import { copyText } from "@/lib/share";
import type { AccountWithBalance, ExpenseRecord } from "@/lib/finance/types";
import { cn } from "@/lib/utils";
import { AccountDialog, BudgetDialog, CategoryDialog, EditTxDialog, TransferDialog } from "./dialogs";
import { CardReminderDialog, cardStatus } from "./CardReminderDialog";

type TypeFilter = "ALL" | "EXPENSE" | "INCOME" | "TRANSFER";

export function ExpensesTab({ onAdd }: { onAdd: (m: "EXPENSE" | "INCOME") => void }) {
  const s = useFinance();
  const balances = useMemo(() => accountsWithBalances(s.bankAccounts, s.expenses), [s.bankAccounts, s.expenses]);
  const net = balances.reduce((a, b) => a + b.currentBalance, 0);
  const inc = totalIncome(s.expenses);
  const exp = totalExpense(s.expenses);
  const month = currentMonthExpenses(s.expenses);
  const bud = budgetStatus(month, s.monthlyBudgetLimit);
  const spend = useMemo(() => currentMonthCategorySpend(s.expenses, s.categories), [s.expenses, s.categories]);

  const [accFilter, setAccFilter] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [dlg, setDlg] = useState<null | "account" | "category" | "transfer" | "budget" | "sms">(null);
  const [edit, setEdit] = useState<ExpenseRecord | null>(null);
  const [del, setDel] = useState<ExpenseRecord | null>(null);
  const [details, setDetails] = useState<AccountWithBalance | null>(null);
  const [opening, setOpening] = useState<{ id: number; v: string } | null>(null);
  const [cardDlg, setCardDlg] = useState<{ open: boolean; id: number | null }>({ open: false, id: null });
  const [smsText, setSmsText] = useState("");

  const byAccount = accFilter != null ? s.expenses.filter((e) => e.bankAccountId === accFilter) : s.expenses;
  const byType = byAccount.filter((e) =>
    typeFilter === "ALL" ? true : typeFilter === "TRANSFER" ? e.type === "TRANSFER_IN" || e.type === "TRANSFER_OUT" : e.type === typeFilter,
  );
  const catsPresent = Array.from(new Set(byType.map((e) => e.categoryName)));
  const shown = (catFilter ? byType.filter((e) => e.categoryName.toLowerCase() === catFilter.toLowerCase()) : byType)
    .slice()
    .sort((a, b) => b.dateTimestamp - a.dateTimestamp);
  const filterAccount = (id: number | null) => {
    setAccFilter((cur) => (cur === id ? null : id));
    setCatFilter(null);
  };

  const quickSms = (text: string) => {
    const p = parseSms(text, s.bankAccounts);
    if (!p) { toast.error("No valid bank/UPI SMS found in clipboard"); return; }
    s.addExpense({ title: p.merchantOrTitle, amount: p.amount, categoryName: p.isIncome ? "Income" : p.suggestedCategory, type: p.isIncome ? "INCOME" : "EXPENSE", bankAccountId: p.matchedAccountId, bankAccountName: p.matchedAccountName, notes: p.rawNotes });
    toast.success(`${p.isIncome ? "Income" : "Expense"} of ${money(p.amount)} logged from SMS`);
    setDlg(null);
    setSmsText("");
  };
  const pasteSms = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t.trim()) { quickSms(t); return; }
    } catch {
      /* fallback below */
    }
    setDlg("sms");
  };

  const linked = del ? findLinkedTransfers(del, s.expenses) : [];
  const isTransfer = del && (del.type === "TRANSFER_IN" || del.type === "TRANSFER_OUT");
  const doDelete = () => {
    if (!del) return;
    const ids = [del.id, ...(linked.length === 1 && linked[0] ? [linked[0].id] : [])];
    const removed = s.deleteExpenses(ids);
    toast(ids.length > 1 ? "Deleted both entries for this transfer" : `Deleted '${del.title}'`, {
      action: { label: "Undo", onClick: () => s.restoreExpenses(removed) },
    });
    setDel(null);
  };

  return (
    <div className="space-y-4">
      <div className="bg-hero space-y-4 rounded-4xl p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold opacity-90">Total Net Balance</p>
          <Pill tone="hero">Live Funds</Pill>
        </div>
        <p className="font-display text-4xl font-extrabold tabular-nums">{money(net)}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-hero-tile flex items-center gap-2 rounded-2xl p-3"><ArrowDown className="size-5 text-income" /><div><p className="text-xs opacity-80">Total Income</p><p className="font-bold text-income">+{moneyWhole(inc)}</p></div></div>
          <div className="bg-hero-tile flex items-center gap-2 rounded-2xl p-3"><ArrowUp className="size-5 text-expense" /><div><p className="text-xs opacity-80">Total Expenses</p><p className="font-bold text-expense">-{moneyWhole(exp)}</p></div></div>
        </div>
      </div>

      <Panel className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-tonal text-tonal-foreground"><Gauge className="size-5" /></span>
          <div className="flex-1"><p className="font-display font-bold">Monthly Expense Budget</p><p className="text-sm text-muted-foreground">Target: {moneyWhole(s.monthlyBudgetLimit)}</p></div>
          <Button variant="ghost" size="icon" aria-label="Edit budget" onClick={() => setDlg("budget")}><Pencil className="text-primary" /></Button>
        </div>
        <div className="flex items-end justify-between">
          <div><p className="text-xs text-muted-foreground">Total Spent This Month</p><p className="font-display text-2xl font-extrabold">{moneyWhole(month)}</p></div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{bud.over100 ? "Over Budget" : "Remaining"}</p>
            <p className={cn("font-display text-xl font-bold", bud.over100 ? "text-expense" : "text-income")}>{bud.over100 ? `+${moneyWhole(month - s.monthlyBudgetLimit)}` : moneyWhole(bud.remaining)}</p>
          </div>
        </div>
        <Progress value={bud.progress} tone={bud.over100 ? "expense" : bud.over80 ? "warning" : "income"} />
        {bud.over100 && <p className="rounded-2xl bg-expense-soft p-2.5 text-sm text-expense">🚨 Warning: You have exceeded your monthly budget by {moneyWhole(month - s.monthlyBudgetLimit)} ({bud.percent}%)!</p>}
        {bud.over80 && <p className="rounded-2xl bg-warning-soft p-2.5 text-sm text-warning">⚠️ Caution: You have reached {bud.percent}% of your monthly target limit.</p>}
      </Panel>

      <SectionTitle title="My Bank & Cash Accounts" subtitle="Track opening balance & live account funds" action={<Button variant="tonal" onClick={() => setDlg("account")}><Plus /> Account</Button>} />
      <div className="scrollbar-none -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
        {balances.map((b) => {
          const reminder = s.creditCardReminders.find((r) => r.accountId === b.account.id);
          const st = reminder ? cardStatus(reminder) : null;
          return (
            <div key={b.account.id} onClick={() => setDetails(b)} className={cn("w-64 shrink-0 cursor-pointer snap-start space-y-2 rounded-3xl border bg-card p-4", accFilter === b.account.id && "border-primary ring-1 ring-primary")}>
              <div className="flex items-center justify-between">
                <Pill tone="primary">{b.account.accountType}</Pill>
                <div className="flex" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" aria-label="Edit opening balance" onClick={() => setOpening({ id: b.account.id, v: String(b.account.openingBalance) })}><Pencil /></Button>
                  <Button variant="ghost" size="icon" aria-label="Show account transactions" onClick={() => filterAccount(b.account.id)}><ReceiptText /></Button>
                </div>
              </div>
              <p className="truncate font-display text-lg font-bold">{b.account.bankName}</p>
              <p className="text-xs text-muted-foreground">Opening: <span className="font-semibold text-foreground">{moneyWhole(b.openingBalance)}</span></p>
              <p className="text-xs text-muted-foreground">Current Balance</p>
              <p className={cn("font-display text-xl font-bold", b.currentBalance >= 0 ? "text-income" : "text-expense")}>{money(b.currentBalance)}</p>
              {isCreditCard(b.account) && (
                <div className="rounded-2xl bg-surface-2 p-2.5" onClick={(e) => { e.stopPropagation(); setCardDlg({ open: true, id: b.account.id }); }}>
                  <p className="flex items-center gap-1 text-xs font-bold"><CreditCard className="size-3.5" /> Credit Card Bill</p>
                  {reminder && st ? (
                    <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                      <span className={cn(st.tone === "income" ? "text-income" : st.tone === "expense" ? "text-expense" : "text-primary")}>{st.paid ? "Paid" : st.label.replace("Payment ", "")}</span>
                      <span className="font-semibold">{money(reminder.amount)}</span>
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">Reminder not set</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <button type="button" onClick={() => setDlg("account")} className="flex w-48 shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed p-4 font-semibold text-primary hover:bg-surface-2">
          <CreditCard className="size-8" /> + Add Account
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        <Button variant="expense" className="h-11" onClick={() => onAdd("EXPENSE")}><Minus /> Expense</Button>
        <Button variant="income" className="h-11" onClick={() => onAdd("INCOME")}><Plus /> Income</Button>
        <Button variant="outline" className="h-11" onClick={pasteSms}><MessageSquareText /> Paste SMS</Button>
        <Button variant="outline" className="h-11" onClick={() => setDlg("transfer")} disabled={s.bankAccounts.length < 2}><ArrowLeftRight /> Transfer</Button>
        <Button variant="outline" className="h-11" onClick={() => setDlg("category")}><Tags /> Category</Button>
      </div>

      {spend.length > 0 && (
        <Panel className="space-y-3">
          <SectionTitle title="Spending Analytics" subtitle="This month by category" action={<Pill tone="primary">{spend.length} Categories</Pill>} />
          <Donut slices={spend.slice(0, 6).map((c) => ({ label: c.categoryName, value: c.totalAmount, color: c.colorHex }))} centerSubtitle="Top" centerTitle={spend[0]?.categoryName ?? ""} size={170} stroke={22} />
        </Panel>
      )}

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">{accFilter != null ? `${s.bankAccounts.find((a) => a.id === accFilter)?.bankName ?? ""} Transactions` : "Recent Transactions"}</h2>
          {accFilter != null && <Button variant="link" size="sm" onClick={() => filterAccount(null)}>Show all</Button>}
        </div>
        <ChipRow>
          {(["ALL", "EXPENSE", "INCOME", "TRANSFER"] as const).map((t) => (
            <Chip key={t} selected={typeFilter === t} onClick={() => { setTypeFilter(t); setCatFilter(null); }}>{t === "ALL" ? "All" : t === "EXPENSE" ? "Expenses" : t === "INCOME" ? "Income" : "Transfers"}</Chip>
          ))}
        </ChipRow>
        {catsPresent.length > 1 && (
          <ChipRow>
            <Chip selected={catFilter === null} onClick={() => setCatFilter(null)}>All Categories</Chip>
            {catsPresent.map((c) => <Chip key={c} selected={catFilter === c} color={s.categories.find((x) => x.name === c)?.colorHex} onClick={() => setCatFilter(catFilter === c ? null : c)}>{c}</Chip>)}
          </ChipRow>
        )}
      </div>
      {shown.length === 0 ? (
        <EmptyState icon={Wallet} title="No transactions yet" text="Log an expense or add income to start tracking your money." />
      ) : (
        <div className="space-y-2">
          {shown.map((e) => {
            const transfer = e.type === "TRANSFER_IN" || e.type === "TRANSFER_OUT";
            const positive = e.type === "INCOME" || e.type === "TRANSFER_IN";
            return (
              <div key={e.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", transfer ? "bg-primary-soft text-primary" : positive ? "bg-income-soft text-income" : "bg-expense-soft text-expense")}>
                  {transfer ? <ArrowLeftRight className="size-4" /> : positive ? <ArrowDown className="size-4" /> : <ArrowUp className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-semibold">{e.title}</p>
                    <p className={cn("shrink-0 font-bold tabular-nums", positive ? "text-income" : "text-expense")}>{positive ? "+ " : "- "}{money(e.amount)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatTimestamp(e.dateTimestamp)}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <Pill>{e.categoryName}</Pill>
                    {e.bankAccountName && <Pill tone="primary">{e.bankAccountName}</Pill>}
                    {e.notes && <span className="truncate text-xs text-muted-foreground">{e.notes}</span>}
                  </div>
                </div>
                <div className="flex flex-col">
                  {!transfer && <Button variant="ghost" size="icon" aria-label="Edit transaction" onClick={() => setEdit(e)}><Pencil /></Button>}
                  <Button variant="ghost" size="icon" aria-label="Delete transaction" onClick={() => setDel(e)}><Trash2 className="text-destructive" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AccountDialog open={dlg === "account"} onOpenChange={(o) => setDlg(o ? "account" : null)} />
      <CategoryDialog open={dlg === "category"} onOpenChange={(o) => setDlg(o ? "category" : null)} />
      <TransferDialog open={dlg === "transfer"} onOpenChange={(o) => setDlg(o ? "transfer" : null)} />
      <BudgetDialog open={dlg === "budget"} onOpenChange={(o) => setDlg(o ? "budget" : null)} />
      <CardReminderDialog open={cardDlg.open} accountId={cardDlg.id} onOpenChange={(o) => setCardDlg({ open: o, id: o ? cardDlg.id : null })} />
      <EditTxDialog tx={edit} onClose={() => setEdit(null)} />
      <Modal open={dlg === "sms"} onOpenChange={(o) => setDlg(o ? "sms" : null)} title="Paste Bank SMS" description="Paste a bank or UPI SMS and OmniCalc will log it instantly." footer={<><Button variant="ghost" onClick={() => setDlg(null)}>Cancel</Button><Button disabled={!smsText.trim()} onClick={() => quickSms(smsText)}>Log from SMS</Button></>}>
        <TextField multiline value={smsText} onChange={setSmsText} placeholder="Rs.450.00 debited from A/c XX1234 to swiggy@upi on 05-11-26" />
      </Modal>

      <Modal
        open={!!del}
        onOpenChange={(o) => !o && setDel(null)}
        title="Delete Transaction?"
        description={
          !del ? "" : isTransfer && linked.length > 1
            ? "More than one matching transfer entry was found, so the linked transaction cannot be identified safely. No transactions were deleted."
            : isTransfer && linked.length === 1
              ? `Delete this transfer and its matching entry from ${linked[0]?.bankAccountName ?? "the other account"}? You can undo both briefly.`
              : isTransfer
                ? `No matching transfer entry was found. Delete '${del.title}' (${money(del.amount)}) only? You can undo it briefly.`
                : `Delete '${del.title}' (${money(del.amount)})? You can undo this briefly after confirming.`
        }
        footer={isTransfer && linked.length > 1 ? <Button onClick={() => setDel(null)}>OK</Button> : <><Button variant="ghost" onClick={() => setDel(null)}>Cancel</Button><Button variant="destructive" onClick={doDelete}>Delete</Button></>}
      />

      <Modal open={!!opening} onOpenChange={(o) => !o && setOpening(null)} title="Edit Opening Balance" footer={<><Button variant="ghost" onClick={() => setOpening(null)}>Cancel</Button><Button onClick={() => { if (opening) { s.updateOpeningBalance(opening.id, num(opening.v)); toast.success("Opening balance updated!"); } setOpening(null); }}>Save</Button></>}>
        <TextField label="Opening Balance (₹)" prefix="₹" value={opening?.v ?? ""} onChange={(v) => /^-?\d*\.?\d*$/.test(v) && opening && setOpening({ ...opening, v })} inputMode="decimal" />
      </Modal>

      <AccountDetails b={details} onClose={() => setDetails(null)} onShowTx={(id) => { filterAccount(id); setDetails(null); }} onCleared={(id) => accFilter === id && setAccFilter(null)} />
    </div>
  );
}

function AccountDetails({ b, onClose, onShowTx, onCleared }: { b: AccountWithBalance | null; onClose: () => void; onShowTx: (id: number) => void; onCleared: (id: number) => void }) {
  const del = useFinance((s) => s.deleteBankAccount);
  const [confirm, setConfirm] = useState(false);
  if (!b) return null;
  const a = b.account;
  const details = `Bank: ${a.bankName}\nAccount Holder: ${a.holderName}\nAccount Number: ${a.accountNumber}\nIFSC / Routing: ${a.ifscOrRouting}\nType: ${a.accountType}`;
  return (
    <>
      <Modal
        open={!confirm}
        onOpenChange={(o) => !o && onClose()}
        title={<span className="flex items-center gap-2"><Landmark className="size-5 text-primary" />{a.bankName}</span>}
        footer={
          <div className="flex w-full flex-wrap justify-end gap-2">
            <Button variant="ghost" className="text-destructive" onClick={() => setConfirm(true)}><Trash2 /> Delete</Button>
            <Button variant="outline" onClick={() => onShowTx(a.id)}><ReceiptText /> Transactions</Button>
            <Button onClick={onClose}>Close</Button>
          </div>
        }
      >
        <div className="divide-y">
          <Row label="Type" value={a.accountType} />
          {a.holderName && <Row label="Account Holder" value={a.holderName} />}
          {a.accountNumber && <Row label="Account Number" value={a.accountNumber} />}
          {a.ifscOrRouting && <Row label="IFSC / Routing" value={a.ifscOrRouting} />}
          <Row label="Opening balance" value={money(b.openingBalance)} />
          <Row label="Total in" value={<span className="text-income">{money(b.totalIncome)}</span>} />
          <Row label="Total out" value={<span className="text-expense">{money(b.totalExpense)}</span>} />
          <Row strong label="Current balance" value={money(b.currentBalance)} />
        </div>
        {a.notes && <p className="text-sm text-muted-foreground">{a.notes}</p>}
        <Button variant="tonal" onClick={() => copyText(details, "Bank details copied to clipboard!")}><Copy /> Copy Details</Button>
      </Modal>
      <Modal
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete account?"
        description={`Are you sure you want to delete "${a.bankName}"? This action cannot be undone.`}
        footer={<><Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button><Button variant="destructive" onClick={() => { onCleared(a.id); del(a.id); toast("Account removed"); setConfirm(false); onClose(); }}>Delete</Button></>}
      />
    </>
  );
}
