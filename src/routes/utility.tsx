import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDownUp, BookmarkPlus, Check, Pencil, ReceiptText, RotateCcw, Ruler, Search, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip, ChipRow, Modal, NumberField, Panel, Row, SectionTitle, TabBar, TextField } from "@/components/omni/ui";
import { calculateGst, convertUnit, DEFAULT_CURRENCIES, UNIT_CATEGORIES, UNITS, type UnitCategory, type UnitItem } from "@/lib/calc/utility";
import { fixedGrouped, money, num } from "@/lib/format";
import { saveToHistory } from "@/lib/history-store";
import { cn } from "@/lib/utils";
import { SplitBillView } from "@/features/splitbill/SplitBillView";

const TABS = [
  { id: "CURRENCY", title: "Currency", icon: Wallet },
  { id: "UNIT_CONVERTER", title: "Units", icon: Ruler },
  { id: "TIP_SPLIT", title: "Split Bill", icon: Users },
  { id: "GST_TAX", title: "GST / Tax", icon: ReceiptText },
] as const;
type Tab = (typeof TABS)[number]["id"];

export const Route = createFileRoute("/utility")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab | undefined } => ({ tab: TABS.some((t) => t.id === s["tab"]) ? (s["tab"] as Tab) : undefined }),
  head: () => ({
    meta: [
      { title: "Currency, Units, Split Bill & GST — OmniCalc" },
      { name: "description", content: "Convert currencies and units, split restaurant bills with settlements and UPI links, and calculate GST." },
      { property: "og:title", content: "Utility Calculators — OmniCalc" },
      { property: "og:description", content: "Currency, unit converter, split bill and GST calculators." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UtilityPage,
});

function UtilityPage() {
  const { tab = "CURRENCY" } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <>
      <TabBar tabs={[...TABS]} value={tab} onChange={(t) => navigate({ search: { tab: t }, replace: true })} />
      <div className="space-y-4 pt-4">
        {tab === "CURRENCY" && <CurrencyView />}
        {tab === "UNIT_CONVERTER" && <UnitsView />}
        {tab === "TIP_SPLIT" && <SplitBillView />}
        {tab === "GST_TAX" && <GstView />}
      </div>
    </>
  );
}

const defaultRates = () => Object.fromEntries(DEFAULT_CURRENCIES.map((c) => [c.code, c.ratePerUsd]));
const PINNED = ["USD", "INR", "EUR", "GBP", "AED", "CAD", "JPY", "AUD", "SGD"];
const QUICK = ["USD", "INR", "EUR", "GBP", "AED", "SAR", "JPY", "CAD", "AUD", "SGD"];
const info = (code: string) => DEFAULT_CURRENCIES.find((c) => c.code === code)!;

function CurrencyView() {
  const [from, setFrom] = useState("USD");
  const [to, setTo] = useState("INR");
  const [amt, setAmt] = useState("100");
  const [rates, setRates] = useState<Record<string, number>>(defaultRates);
  const [picker, setPicker] = useState<"from" | "to" | null>(null);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const amount = num(amt);
  const out = (amount / (rates[from] ?? 1)) * (rates[to] ?? 1);
  const fwd = (rates[to] ?? 1) / (rates[from] ?? 1);

  const save = () =>
    saveToHistory(
      {
        category: "CURRENCY",
        title: `Currency: ${amt} ${from} = ${fixedGrouped(out)} ${to}`,
        summary: `Base: ${from} -> Target: ${to} (Rate: ${(out / (num(amt) || 1)).toFixed(4)})`,
        detailsText: `Amount: ${amt} ${from}\nConverted: ${fixedGrouped(out)} ${to}\nExchange Date: Today\nOmniCalc Currency Engine`,
      },
      "Currency saved to history!",
    );

  const CurCard = ({ code, label, side }: { code: string; label: string; side: "from" | "to" }) => {
    const c = info(code);
    return (
      <button type="button" onClick={() => { setQ(""); setPicker(side); }} className="flex-1 rounded-2xl border bg-background p-3 text-left hover:bg-surface-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 font-bold">{c.flag} {c.code}</p>
        <p className="truncate text-xs text-muted-foreground">{c.name}</p>
      </button>
    );
  };

  return (
    <>
      <Panel className="space-y-4">
        <SectionTitle
          title="Currency Calculator"
          subtitle="Benchmark exchange rates — tap ✏️ to set today's rate"
          action={
            <div className="flex">
              <Button variant="ghost" size="icon" aria-label="Reset benchmark rates" onClick={() => { setRates(defaultRates()); toast("Exchange rates reset to standard market rates"); }}><RotateCcw /></Button>
              <Button variant="ghost" size="icon" aria-label="Save currency conversion" onClick={save}><BookmarkPlus /></Button>
            </div>
          }
        />
        <NumberField label={`Amount in ${from} to Convert`} prefix={info(from).symbol} value={amt} onChange={setAmt} />
        <p className="text-sm font-medium text-muted-foreground">Pinned Favorite Currencies (Tap to set target):</p>
        <ChipRow>
          {PINNED.map((c) => (
            <Chip key={c} selected={to === c} onClick={() => { if (c === from) { setFrom(to); setTo(from); } else setTo(c); }}>{info(c).flag} {c} ({c === "AED" ? "د.إ" : info(c).symbol})</Chip>
          ))}
        </ChipRow>
        <p className="text-sm font-medium text-muted-foreground">Choose Currencies (Tap card to change)</p>
        <div className="flex items-center gap-2">
          <CurCard code={from} label="From (Source)" side="from" />
          <Button variant="tonal" size="round" aria-label="Swap Currencies" onClick={() => { setFrom(to); setTo(from); }}><ArrowDownUp className="rotate-90" /></Button>
          <CurCard code={to} label="To (Target)" side="to" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">Quick Currency Pick:</p>
        <ChipRow>{QUICK.map((c) => <Chip key={c} selected={to === c} onClick={() => setTo(c)}>{c}</Chip>)}</ChipRow>
      </Panel>
      <Panel className="space-y-1 bg-primary-soft/60">
        <p className="text-sm text-muted-foreground">Converted Amount</p>
        <p className="font-display text-4xl font-extrabold text-primary tabular-nums">{info(to).flag} {info(to).symbol} {fixedGrouped(out)}</p>
        <p className="text-sm text-muted-foreground">1 {from} = {fixedGrouped(fwd, 4)} {to}</p>
        <p className="text-sm text-muted-foreground">1 {to} = {fixedGrouped(1 / fwd, 4)} {from}</p>
      </Panel>
      <Panel className="space-y-2">
        <SectionTitle title="Exchange Rates Board" subtitle="Tap ✏️ to customize rate" />
        {DEFAULT_CURRENCIES.map((c) => {
          const v = (amount / (rates[from] ?? 1)) * (rates[c.code] ?? c.ratePerUsd);
          return (
            <div key={c.code} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
              <span className="text-2xl">{c.flag}</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold">{c.code} <span className="font-normal text-muted-foreground">{c.name}</span></p>
                <p className="text-xs text-muted-foreground">1 {from} = {((rates[c.code] ?? 1) / (rates[from] ?? 1)).toFixed(4)}</p>
              </div>
              <p className="font-semibold tabular-nums">{c.symbol} {fixedGrouped(v)}</p>
              <Button variant="ghost" size="icon" aria-label="Edit Rate" onClick={() => { setEdit(c.code); setEditVal(String(rates[c.code])); }}><Pencil /></Button>
            </div>
          );
        })}
      </Panel>

      <Modal open={!!picker} onOpenChange={(o) => !o && setPicker(null)} title={picker === "from" ? "Select Source Currency" : "Select Target Currency"} footer={<Button variant="ghost" onClick={() => setPicker(null)}>Close</Button>}>
        <div className="flex items-center gap-2 rounded-2xl border px-3"><Search className="size-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search currency..." className="h-11 w-full bg-transparent outline-none" /></div>
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {DEFAULT_CURRENCIES.filter((c) => `${c.code} ${c.name}`.toLowerCase().includes(q.toLowerCase())).map((c) => {
            const sel = (picker === "from" ? from : to) === c.code;
            return (
              <button key={c.code} type="button" onClick={() => { if (picker === "from") setFrom(c.code); else setTo(c.code); setPicker(null); }} className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left hover:bg-surface-2">
                <span className="text-xl">{c.flag}</span>
                <span className="flex-1">{c.code} - {c.name}</span>
                {sel && <Check className="size-4 text-primary" />}
              </button>
            );
          })}
        </div>
      </Modal>

      <Modal
        open={!!edit}
        onOpenChange={(o) => !o && setEdit(null)}
        title={`Set Live Rate for ${edit}`}
        description="Enter the exact real-time rate per 1 US Dollar (USD):"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
            <Button onClick={() => {
              const v = num(editVal, rates[edit!]);
              if (v > 0 && edit) { setRates({ ...rates, [edit]: v }); toast.success(`Updated rate for ${edit}: 1 USD = ${v}`); }
              setEdit(null);
            }}>Save Live Rate</Button>
          </>
        }
      >
        <TextField label={`1 USD = how many ${edit}`} prefix={edit ? info(edit).symbol : ""} value={editVal} onChange={(v) => setEditVal(v.replace(/[^0-9.]/g, ""))} inputMode="decimal" />
      </Modal>
    </>
  );
}

const fmt4 = (v: number) => fixedGrouped(v, 4).replace(/\.?0+$/, "");

function pickUnit(list: readonly UnitItem[], id: string, fallback: number): UnitItem {
  const u = list.find((x) => x.id === id) ?? list[fallback] ?? list[0];
  if (!u) throw new Error("Unit list is empty");
  return u;
}

function UnitsView() {
  const [cat, setCat] = useState<UnitCategory>("LENGTH");
  const [from, setFrom] = useState("m");
  const [to, setTo] = useState("km");
  const [val, setVal] = useState("1");
  const units = UNITS[cat];
  const f = pickUnit(units, from, 0);
  const t = pickUnit(units, to, 1);
  const out = useMemo(() => convertUnit(cat, num(val), f, t), [cat, val, f, t]);
  const one = convertUnit(cat, 1, f, t);
  const pickCat = (c: UnitCategory) => { setCat(c); setFrom(UNITS[c][0]?.id ?? ""); setTo(UNITS[c][1]?.id ?? ""); };
  const save = () =>
    saveToHistory(
      { category: "UNIT", title: `${val} ${f.symbol} = ${out.toFixed(4)} ${t.symbol}`, summary: `Category: ${UNIT_CATEGORIES.find((c) => c.id === cat)!.title}`, detailsText: `${val} ${f.name} converted to ${t.name}: ${out}` },
      "Units saved to history!",
    );
  const Sel = ({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) => (
    <label className="flex-1 space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-full rounded-2xl border bg-background px-3">
        {units.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>)}
      </select>
    </label>
  );
  return (
    <>
      <Panel className="space-y-4">
        <SectionTitle title="Unit Converter" action={<Button variant="ghost" size="icon" aria-label="Save conversion" onClick={save}><BookmarkPlus /></Button>} />
        <p className="text-sm font-medium text-muted-foreground">Category:</p>
        <ChipRow>{UNIT_CATEGORIES.map((c) => <Chip key={c.id} selected={cat === c.id} onClick={() => pickCat(c.id)}>{c.title}</Chip>)}</ChipRow>
        <NumberField label="Enter value to convert" value={val} onChange={setVal} />
        <div className="flex items-end gap-2">
          <Sel label="From" value={f.id} onChange={setFrom} />
          <Button variant="tonal" size="round" aria-label="Swap units" onClick={() => { setFrom(t.id); setTo(f.id); }}><ArrowDownUp className="rotate-90" /></Button>
          <Sel label="To" value={t.id} onChange={setTo} />
        </div>
      </Panel>
      <Panel className="space-y-1 bg-primary-soft/60">
        <p className="text-sm text-muted-foreground">Converted Result</p>
        <p className="font-display text-4xl font-extrabold text-primary tabular-nums">{fmt4(out)} {t.symbol}</p>
        <p className="text-sm text-muted-foreground">1 {f.symbol} = {fixedGrouped(one, 4)} {t.symbol}</p>
      </Panel>
    </>
  );
}

function GstView() {
  const [amt, setAmt] = useState("1000");
  const [rate, setRate] = useState(18);
  const [excl, setExcl] = useState(true);
  const r = calculateGst(num(amt), rate, excl);
  const save = () =>
    saveToHistory(
      { category: "GST", title: `GST ${rate.toFixed(1)}%: Total ${money(r.finalTotalAmount)}`, summary: `Base: ${money(r.baseAmount)} + Tax: ${money(r.gstAmount)}`, detailsText: `Base: ${r.baseAmount}\nGST (${rate.toFixed(1)}%): ${r.gstAmount}\nCGST: ${r.cgstAmount}\nSGST: ${r.sgstAmount}\nTotal: ${r.finalTotalAmount}` },
      "GST / Tax saved to history!",
    );
  return (
    <>
      <Panel className="space-y-4">
        <SectionTitle title="GST & Tax Calculator" action={<Button variant="ghost" size="icon" aria-label="Save GST" onClick={save}><BookmarkPlus /></Button>} />
        <p className="text-sm font-medium text-muted-foreground">Select Calculation Mode:</p>
        <div className="grid grid-cols-2 gap-2">
          {([[true, "Add GST", "Exclusive Tax"], [false, "Remove GST", "Inclusive Tax"]] as const).map(([v, a, b]) => (
            <button key={a} type="button" onClick={() => setExcl(v)} className={cn("rounded-2xl border p-3 text-left", excl === v ? "border-primary bg-primary-soft" : "hover:bg-surface-2")}>
              <p className={cn("font-bold", excl === v && "text-primary")}>{a}</p>
              <p className="text-xs text-muted-foreground">{b}</p>
            </button>
          ))}
        </div>
        <NumberField label={excl ? "Net Base Amount" : "Gross Total Amount (with GST)"} prefix="₹" value={amt} onChange={setAmt} />
        <p className="text-sm font-medium text-muted-foreground">GST Slab ({rate}%)</p>
        <ChipRow>{[0, 5, 12, 18, 28].map((s) => <Chip key={s} selected={rate === s} onClick={() => setRate(s)}>{s}%</Chip>)}</ChipRow>
      </Panel>
      <Panel className="divide-y">
        <Row label="Actual Net Amount:" value={money(r.baseAmount)} />
        <Row label={`Total GST (${rate}%):`} value={money(r.gstAmount)} />
        <Row label={`• CGST (${rate / 2}%):`} value={money(r.cgstAmount)} />
        <Row label={`• SGST (${rate / 2}%):`} value={money(r.sgstAmount)} />
        <Row strong label="Final Total Amount:" value={<span className="text-primary">{money(r.finalTotalAmount)}</span>} />
      </Panel>
    </>
  );
}
