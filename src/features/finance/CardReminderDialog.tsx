import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Chip, ChipRow, Modal, TextField } from "@/components/omni/ui";
import { useFinance } from "@/lib/finance/store";
import { isCreditCard } from "@/lib/finance/logic";
import { fromEpochDay, parseISO, plusDays, toEpochDay, toISO, today } from "@/lib/calc/dates";
import { num } from "@/lib/format";

/** Credit card due-date reminder (shown in-app; the web can't schedule phone notifications). */
export function CardReminderDialog({ open, onOpenChange, accountId }: { open: boolean; onOpenChange: (o: boolean) => void; accountId?: number | null }) {
  const allAccounts = useFinance((s) => s.bankAccounts);
  const accounts = allAccounts.filter(isCreditCard);
  const reminders = useFinance((s) => s.creditCardReminders);
  const save = useFinance((s) => s.saveCardReminder);
  const [acc, setAcc] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState(toISO(plusDays(today(), 7)));

  const load = (id: number | null) => {
    setAcc(id);
    const r = reminders.find((x) => x.accountId === id);
    setAmount(r ? String(r.amount) : "");
    setDue(r ? toISO(fromEpochDay(r.dueDateEpochDay)) : toISO(plusDays(today(), 7)));
  };
  useEffect(() => {
    if (!open) return;
    const first = accountId ?? accounts.find((a) => !reminders.some((r) => r.accountId === a.id))?.id ?? accounts[0]?.id ?? null;
    load(first);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const dueDate = parseISO(due);
  const past = dueDate ? toEpochDay(dueDate) < toEpochDay(today()) : true;
  const ok = acc != null && num(amount) > 0 && !past;
  const name = accounts.find((a) => a.id === acc)?.bankName ?? "";

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Credit card due dates"
      description="Payment reminders for your credit cards. Alerts appear in the app 3 days before and on the due date."
      footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={!ok} onClick={() => {
        save({ accountId: acc!, amount: num(amount), dueDateEpochDay: toEpochDay(dueDate!), paidDateEpochDay: -1, notificationsEnabled: true });
        toast.success(`Payment reminder saved for ${name}`);
        onOpenChange(false);
      }}>Save reminder</Button></>}
    >
      {accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Add a credit card in Finance to track its payment due date.</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Credit card</p>
          <ChipRow>{accounts.map((a) => <Chip key={a.id} selected={acc === a.id} onClick={() => accountId == null && load(a.id)}>{a.bankName}</Chip>)}</ChipRow>
          <TextField label="Statement amount" prefix="₹" value={amount} onChange={(v) => /^\d*\.?\d*$/.test(v) && setAmount(v)} inputMode="decimal" />
          <TextField label="Payment due date" type="date" value={due} onChange={setDue} error={past ? "Choose today or a later date." : undefined} />
        </>
      )}
    </Modal>
  );
}

export function cardStatus(r: { dueDateEpochDay: number; paidDateEpochDay: number }) {
  const days = r.dueDateEpochDay - toEpochDay(today());
  const paid = r.paidDateEpochDay >= 0;
  const label = paid ? "Paid" : days === 0 ? "Payment due today" : days === 1 ? "Payment due tomorrow" : days < 0 ? `${-days} days overdue` : `Payment due in ${days} days`;
  const tone: "income" | "expense" | "primary" = paid ? "income" : days <= 3 ? "expense" : "primary";
  return { days, paid, label, tone };
}
