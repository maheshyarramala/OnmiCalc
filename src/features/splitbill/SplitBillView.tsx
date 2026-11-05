import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BellRing, Camera, CheckCircle2, Plus, ScanLine, Share2, Trash2, UserPlus, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Chip, ChipRow, EmptyState, Modal, Panel, Pill, Progress, SectionTitle, TabBar, TextField } from "@/components/omni/ui";
import {
  AVATAR_COLORS, breakdownShareText, calculateBreakdowns, DEMO_RECEIPTS, nudgeText, parseReceiptText, paypalLink,
  settleTransfers, uid, upiLink, type Participant, type ReceiptItem,
} from "@/lib/calc/splitbill";
import { num } from "@/lib/format";
import { shareText } from "@/lib/share";
import { cn } from "@/lib/utils";

const CURRENCIES = [["INR", "₹"], ["USD", "$"], ["EUR", "€"], ["GBP", "£"], ["AED", "د.إ"], ["CAD", "$"], ["AUD", "$"], ["JPY", "¥"]] as const;
const m2 = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function SplitBillView() {
  const [title, setTitle] = useState("Split Bill");
  const [cur, setCur] = useState<(typeof CURRENCIES)[number]>(CURRENCIES[0]);
  const [people, setPeople] = useState<Participant[]>([{ id: "p1", name: "You (Me)", avatarColorHex: "#4F46E5", upiId: "", paypalUsername: "", paidAmount: 0 }]);
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [adj, setAdj] = useState({ tax: 0, tip: 0, discount: 0 });
  const [simplify, setSimplify] = useState(true);
  const [tab, setTab] = useState<"ITEMS" | "DINERS" | "SETTLE">("ITEMS");
  const [settled, setSettled] = useState<Set<string>>(new Set());
  const [quickName, setQuickName] = useState("");
  const [personDlg, setPersonDlg] = useState(false);
  const [itemDlg, setItemDlg] = useState(false);
  const [scan, setScan] = useState(false);
  const sym = cur[1];

  const breakdowns = useMemo(() => calculateBreakdowns(people, items, adj.tax, adj.tip, adj.discount), [people, items, adj]);
  const transfers = useMemo(() => settleTransfers(breakdowns, simplify), [breakdowns, simplify]);
  const totalBill = breakdowns.reduce((s, b) => s + b.totalToPay, 0);
  const totalPaid = breakdowns.reduce((s, b) => s + b.paidAmount, 0);
  const status = totalBill <= 0 ? "No Items" : Math.abs(totalPaid - totalBill) < 0.005 ? "Fully Paid ✓" : totalPaid < totalBill ? `Owed: ${sym}${m2(totalBill - totalPaid)}` : `Overpaid: ${sym}${m2(totalPaid - totalBill)}`;

  const addPerson = (name: string, upi = "", paypal = "", paid = 0) =>
    setPeople((p) => [...p, { id: uid(), name: name.trim() || `Diner ${p.length + 1}`, avatarColorHex: AVATAR_COLORS[p.length % AVATAR_COLORS.length] ?? "#6366F1", upiId: upi.trim(), paypalUsername: paypal.trim(), paidAmount: isFinite(paid) && paid > 0 ? paid : 0 }]);
  const removePerson = (id: string) => {
    setPeople((p) => p.filter((x) => x.id !== id));
    setItems((l) => l.map((i) => ({ ...i, claimedParticipantIds: i.claimedParticipantIds.filter((c) => c !== id), paidByParticipantId: i.paidByParticipantId === id ? null : i.paidByParticipantId })));
  };
  const toggleClaim = (item: ReceiptItem, pid: string) =>
    setItems((l) => l.map((i) => {
      if (i.id !== item.id) return i;
      const base = i.claimedParticipantIds.length ? i.claimedParticipantIds : people.map((p) => p.id);
      return { ...i, claimedParticipantIds: base.includes(pid) ? base.filter((x) => x !== pid) : [...base, pid] };
    }));
  const applyReceipt = (text: string, t: string) => {
    const r = parseReceiptText(text, t);
    setTitle(r.title);
    setItems(r.items);
    setAdj({ tax: r.tax, tip: r.tip, discount: r.discount });
    setScan(false);
    toast.success(`Imported ${r.items.length} items from receipt`);
  };

  return (
    <div className="space-y-4">
      <div className="bg-hero space-y-3 rounded-4xl p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-transparent font-display text-xl font-bold outline-none" aria-label="Bill title" />
            <p className="text-sm opacity-80">{people.length} participants</p>
          </div>
          <Button variant="hero" size="sm" onClick={() => setScan(true)}><ScanLine /> Scan Receipt</Button>
        </div>
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-xs opacity-80">Total Group Bill</p>
            <p className="font-display text-3xl font-extrabold tabular-nums">{sym}{m2(totalBill)}</p>
          </div>
          <select value={cur[0]} onChange={(e) => setCur(CURRENCIES.find((c) => c[0] === e.target.value)!)} className="bg-hero-soft rounded-xl px-2 py-1.5 text-sm text-hero-foreground outline-none">
            {CURRENCIES.map(([c, s]) => <option key={c} value={c} className="text-foreground">{c} ({s})</option>)}
          </select>
        </div>
        <Pill tone="hero">{status}</Pill>
      </div>

      <TabBar tabs={[{ id: "ITEMS", title: "Items & Bill" }, { id: "DINERS", title: `Diners (${people.length})` }, { id: "SETTLE", title: "Settlement" }]} value={tab} onChange={setTab} />

      {tab === "ITEMS" && (
        <div className="space-y-3">
          <SectionTitle title={`Dishes & Line Items (${items.length})`} subtitle="Tap diner avatar to assign who ate/drank each item" action={<Button variant="tonal" size="sm" onClick={() => setItemDlg(true)}><Plus /> Add dish</Button>} />
          {items.length === 0 ? (
            <EmptyState icon={ScanLine} title="No dishes added yet" text="Add dishes manually or scan your receipt to claim items" action={<div className="flex gap-2"><Button onClick={() => setItemDlg(true)}>Add Dish</Button><Button variant="outline" onClick={() => setScan(true)}>Scan Receipt</Button></div>} />
          ) : (
            items.map((it) => {
              const payer = people.find((p) => p.id === it.paidByParticipantId);
              const claimed = it.claimedParticipantIds.length ? it.claimedParticipantIds : people.map((p) => p.id);
              return (
                <Panel key={it.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{it.quantity > 1 ? `${it.quantity}x ` : ""}{it.title}</p>
                    <div className="flex items-center gap-1">
                      <span className="font-bold tabular-nums">{sym}{m2(it.price * it.quantity)}</span>
                      <Button variant="ghost" size="icon" aria-label="Delete item" onClick={() => setItems((l) => l.filter((x) => x.id !== it.id))}><Trash2 className="text-destructive" /></Button>
                    </div>
                  </div>
                  {payer && <p className="text-xs text-muted-foreground">Paid by {payer.name}</p>}
                  <p className="text-xs font-semibold text-muted-foreground">Claimed by:</p>
                  <ChipRow>
                    <Chip selected={claimed.length === people.length} onClick={() => setItems((l) => l.map((x) => (x.id === it.id ? { ...x, claimedParticipantIds: people.map((p) => p.id) } : x)))}>All Split</Chip>
                    {people.map((p) => (
                      <Chip key={p.id} selected={claimed.includes(p.id)} color={p.avatarColorHex} onClick={() => toggleClaim(it, p.id)}>{p.name}</Chip>
                    ))}
                    <Chip onClick={() => setPersonDlg(true)} icon={<UserPlus className="size-4" />}>Add Person</Chip>
                  </ChipRow>
                </Panel>
              );
            })
          )}
          {(adj.tax > 0 || adj.tip > 0 || adj.discount > 0) && (
            <Panel className="grid grid-cols-3 gap-2 text-center text-sm">
              <div><p className="text-xs text-muted-foreground">Tax</p><p className="font-bold">{sym}{m2(adj.tax)}</p></div>
              <div><p className="text-xs text-muted-foreground">Tip / Service</p><p className="font-bold">{sym}{m2(adj.tip)}</p></div>
              <div><p className="text-xs text-muted-foreground">Discount</p><p className="font-bold text-income">-{sym}{m2(adj.discount)}</p></div>
            </Panel>
          )}
        </div>
      )}

      {tab === "DINERS" && (
        <div className="space-y-3">
          <SectionTitle title="Diners & Individual Shares" subtitle="Track consumed share, who paid, and net balance" action={<Button variant="tonal" size="sm" onClick={() => setPersonDlg(true)}><Plus /> Diner</Button>} />
          <div className="flex gap-2">
            <TextField className="flex-1" value={quickName} onChange={setQuickName} placeholder="Add diner name (e.g. Rahul, Priya)..." />
            <Button className="h-11 self-end" disabled={!quickName.trim()} onClick={() => { addPerson(quickName); setQuickName(""); }}>Add</Button>
          </div>
          {people.length === 0 ? (
            <EmptyState icon={Users} title="No Diners Added" text="Type a name above or tap '+ Diner' to add people to split this bill." />
          ) : (
            <>
              {totalBill > 0 && (
                <Panel className="space-y-2">
                  <p className="font-display font-bold">Share distribution</p>
                  {breakdowns.map((b) => (
                    <div key={b.participant.id} className="space-y-1">
                      <div className="flex justify-between text-sm"><span>{b.participant.name}</span><span className="tabular-nums">{sym}{m2(b.totalToPay)} · {((b.totalToPay / totalBill) * 100).toFixed(1)}%</span></div>
                      <Progress value={b.totalToPay / totalBill} />
                    </div>
                  ))}
                </Panel>
              )}
              {breakdowns.map((b) => {
                const out = transfers.filter((t) => t.fromParticipant.id === b.participant.id);
                const inc = transfers.filter((t) => t.toParticipant.id === b.participant.id);
                return (
                  <Panel key={b.participant.id} className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-full font-bold text-white" style={{ backgroundColor: b.participant.avatarColorHex }}>{b.participant.name[0]?.toUpperCase()}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{b.participant.name}</p>
                        {b.participant.upiId && <p className="text-xs text-muted-foreground">UPI: {b.participant.upiId}</p>}
                      </div>
                      <div className="text-right"><p className="font-bold tabular-nums">{sym}{m2(b.totalToPay)}</p><p className="text-xs text-muted-foreground">Total Share</p></div>
                      <Button variant="ghost" size="icon" aria-label="Remove diner" onClick={() => removePerson(b.participant.id)}><X /></Button>
                    </div>
                    <p className="text-sm text-muted-foreground">Paid {sym}{m2(b.paidAmount)} of {sym}{m2(b.totalToPay)} share</p>
                    {out.map((t) => <Pill key={t.toParticipant.id} tone="expense">Owes {t.toParticipant.name} {sym}{m2(t.amount)}</Pill>)}
                    {inc.map((t) => <Pill key={t.fromParticipant.id} tone="income">Gets back {sym}{m2(t.amount)} from {t.fromParticipant.name}</Pill>)}
                    {!out.length && !inc.length && <Pill tone="income">Settled</Pill>}
                    <TextField label="Other paid" prefix={sym} value={b.participant.paidAmount ? String(b.participant.paidAmount) : ""} placeholder="0" inputMode="decimal" onChange={(v) => {
                      const n = Number(v);
                      if (v === "" || (isFinite(n) && n >= 0)) setPeople((l) => l.map((p) => (p.id === b.participant.id ? { ...p, paidAmount: v === "" ? 0 : n } : p)));
                    }} />
                  </Panel>
                );
              })}
            </>
          )}
        </div>
      )}

      {tab === "SETTLE" && (
        <div className="space-y-3">
          <Panel className="flex items-center justify-between gap-3">
            <div><p className="font-semibold">Simplify Debts (Graph Minimization)</p><p className="text-xs text-muted-foreground">Minimizes total number of payments across group</p></div>
            <Switch checked={simplify} onCheckedChange={setSimplify} />
          </Panel>
          <SectionTitle title={`Who Owes Whom (${transfers.length} transactions)`} action={<Button variant="tonal" size="sm" onClick={() => shareText(breakdownShareText(title, sym, totalBill, breakdowns, transfers), "Share Bill Summary")}><Share2 /> Share</Button>} />
          {transfers.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="All Debts Settled!" text="Everyone has paid their exact share or no debts remain." />
          ) : (
            transfers.map((t) => {
              const key = `${t.fromParticipant.id}_${t.toParticipant.id}_${t.amount}`;
              const done = settled.has(key);
              return (
                <Panel key={key} className={cn("space-y-3", done && "opacity-60")}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{t.fromParticipant.name} → {t.toParticipant.name}</p>
                    <p className="font-bold text-primary tabular-nums">{sym}{m2(t.amount)}</p>
                  </div>
                  {t.toParticipant.upiId && <p className="text-xs text-muted-foreground">UPI: {t.toParticipant.upiId}</p>}
                  <div className="flex flex-wrap gap-2">
                    {t.toParticipant.upiId && <Button size="sm" variant="tonal" asChild><a href={upiLink(t.toParticipant.upiId, t.toParticipant.name, t.amount, cur[0])}>Pay UPI</a></Button>}
                    {t.toParticipant.paypalUsername && <Button size="sm" variant="outline" asChild><a href={paypalLink(t.toParticipant.paypalUsername, t.amount)} target="_blank" rel="noreferrer">PayPal</a></Button>}
                    <Button size="sm" variant="outline" onClick={() => shareText(nudgeText(t.fromParticipant.name, t.amount, sym, title, t.toParticipant.upiId), `Send Reminder to ${t.fromParticipant.name}`)}><BellRing /> Nudge</Button>
                    <Button size="sm" variant={done ? "income" : "ghost"} onClick={() => setSettled((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; })}><CheckCircle2 /> {done ? "Settled" : "Mark Settled"}</Button>
                  </div>
                </Panel>
              );
            })
          )}
        </div>
      )}

      <AddPersonDialog open={personDlg} onOpenChange={setPersonDlg} onAdd={addPerson} />
      <AddItemDialog open={itemDlg} onOpenChange={setItemDlg} people={people} sym={sym} onAdd={(i) => setItems((l) => [...l, i])} />
      <Modal open={scan} onOpenChange={setScan} title="Receipt Import" description="Paste receipt text or try a sample — items, taxes, tips & discounts are extracted automatically.">
        <ScanSheet onApply={applyReceipt} />
      </Modal>
    </div>
  );
}

function ScanSheet({ onApply }: { onApply: (text: string, title: string) => void }) {
  const [text, setText] = useState("");
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-2xl bg-surface-2 p-3 text-sm text-muted-foreground"><Camera className="size-5 shrink-0" />Photo scanning isn't available on the web yet — paste the receipt text instead.</div>
      <p className="text-sm font-semibold">Or test instantly with sample receipts:</p>
      <ChipRow>
        <Chip onClick={() => onApply(DEMO_RECEIPTS.bistro, "Italian Bistro")}>🍕 Italian Bistro</Chip>
        <Chip onClick={() => onApply(DEMO_RECEIPTS.cafe, "Artisan Cafe")}>☕ Cafe & Brunch</Chip>
        <Chip onClick={() => onApply(DEMO_RECEIPTS.sushi, "Sushi Kitchen")}>🍣 Sushi Dinner</Chip>
      </ChipRow>
      <TextField multiline value={text} onChange={setText} placeholder="Or paste raw receipt text here..." />
      <Button className="w-full" disabled={!text.trim()} onClick={() => onApply(text, "Pasted Receipt")}>Parse Pasted Receipt Text</Button>
    </div>
  );
}

function AddPersonDialog({ open, onOpenChange, onAdd }: { open: boolean; onOpenChange: (o: boolean) => void; onAdd: (n: string, u: string, p: string, paid: number) => void }) {
  const [n, setN] = useState("");
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [paid, setPaid] = useState("");
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Add Participant / Diner" footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={() => { onAdd(n, u, p, num(paid)); setN(""); setU(""); setP(""); setPaid(""); onOpenChange(false); }}>Add Diner</Button></>}>
      <TextField label="Diner Name" value={n} onChange={setN} />
      <TextField label="UPI ID (Optional for GPay/PhonePe)" placeholder="e.g. name@okhdfcbank" value={u} onChange={setU} />
      <TextField label="PayPal Username (Optional)" placeholder="e.g. johndoe" value={p} onChange={setP} />
      <TextField label="Amount Paid upfront (if any)" value={paid} onChange={(v) => /^\d*\.?\d*$/.test(v) && setPaid(v)} inputMode="decimal" />
    </Modal>
  );
}

function AddItemDialog({ open, onOpenChange, people, sym, onAdd }: { open: boolean; onOpenChange: (o: boolean) => void; people: Participant[]; sym: string; onAdd: (i: ReceiptItem) => void }) {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("1");
  const [sel, setSel] = useState<string[] | null>(null);
  const [payer, setPayer] = useState<string | null | undefined>(undefined);
  const selected = sel ?? people.map((p) => p.id);
  const payerId = payer === undefined ? (people[0]?.id ?? null) : payer;
  const reset = () => { setTitle(""); setPrice(""); setQty("1"); setSel(null); setPayer(undefined); };
  return (
    <Modal
      open={open}
      onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}
      title="Add Dish / Line Item"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!title.trim() || !price.trim()} onClick={() => {
            const p = Number(price);
            const q = /^\d+$/.test(qty) ? Math.max(1, parseInt(qty, 10)) : 1;
            onAdd({ id: uid(), title: title.trim() || "Item", price: isFinite(p) && p > 0 ? p : 0, quantity: q, claimedParticipantIds: selected.length === people.length ? [] : selected, paidByParticipantId: payerId });
            reset();
            onOpenChange(false);
          }}>Add Item</Button>
        </>
      }
    >
      <TextField label="Dish / Item Title" value={title} onChange={setTitle} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label={`Price (${sym})`} value={price} onChange={(v) => /^\d*\.?\d*$/.test(v) && setPrice(v)} inputMode="decimal" />
        <TextField label="Quantity" value={qty} onChange={(v) => /^\d*$/.test(v) && setQty(v)} inputMode="numeric" />
      </div>
      <p className="text-sm font-semibold">Split this item with</p>
      <ChipRow>
        {people.map((p) => (
          <Chip key={p.id} color={p.avatarColorHex} selected={selected.includes(p.id)} onClick={() => {
            if (selected.includes(p.id) && selected.length === 1) return;
            setSel(selected.includes(p.id) ? selected.filter((x) => x !== p.id) : [...selected, p.id]);
          }}>{p.name}</Chip>
        ))}
      </ChipRow>
      <p className="text-sm font-semibold">{payerId ? `Paid by: ${people.find((p) => p.id === payerId)?.name}` : "Choose who paid"}</p>
      <ChipRow>
        {people.map((p) => <Chip key={p.id} selected={payerId === p.id} onClick={() => setPayer(payerId === p.id ? null : p.id)}>{p.name}</Chip>)}
      </ChipRow>
    </Modal>
  );
}
