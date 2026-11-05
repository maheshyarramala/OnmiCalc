import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BookmarkPlus, Banknote, Landmark, Percent, PiggyBank, TrendingUp, LineChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Donut, GrowthChart } from "@/components/omni/charts";
import { Chip, ChipRow, NumberField, Panel, Row, SectionTitle, Stat, TabBar } from "@/components/omni/ui";
import { calculateCompound, calculateEquityTradePnl, calculateFd, calculateLumpSum, calculatePpf, calculateSip, INV_FREQUENCIES, type InvFrequency } from "@/lib/calc/investment";
import { int, money, num } from "@/lib/format";
import { saveToHistory } from "@/lib/history-store";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "SIP", title: "SIP", icon: TrendingUp },
  { id: "LUMPSUM", title: "Lump Sum", icon: Banknote },
  { id: "COMPOUND", title: "Compound Int.", icon: Percent },
  { id: "PPF", title: "PPF", icon: Landmark },
  { id: "FD", title: "Fixed Deposit", icon: PiggyBank },
  { id: "TRADE", title: "Trade P&L", icon: LineChart },
] as const;
type Tab = (typeof TABS)[number]["id"];

export const Route = createFileRoute("/invest")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab | undefined } => ({ tab: TABS.some((t) => t.id === s["tab"]) ? (s["tab"] as Tab) : undefined }),
  head: () => ({
    meta: [
      { title: "SIP, Lump Sum, PPF & FD Calculators — OmniCalc" },
      { name: "description", content: "Project SIP and lump sum growth, compound interest, PPF and fixed deposit maturity, and equity trade P&L with charges." },
      { property: "og:title", content: "Investment Calculators — OmniCalc" },
      { property: "og:description", content: "SIP, lump sum, compound interest, PPF, FD and trade P&L calculators." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InvestPage,
});

const RATE_PRESETS: [string, number][] = [["10.0%", 10], ["12.0%", 12], ["15.0%", 15], ["18.0%", 18]];

function InvestPage() {
  const { tab = "SIP" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [sip, setSip] = useState({ m: "10000", r: "12", y: "10" });
  const [ls, setLs] = useState({ p: "100000", r: "12", y: "5" });
  const [ci, setCi] = useState({ p: "100000", r: "9.5", y: "5", f: "QUARTERLY" as InvFrequency });
  const [ppf, setPpf] = useState({ a: "150000", y: "15" });
  const [fd, setFd] = useState({ p: "200000", r: "7.5", y: "3" });

  const result = useMemo(() => {
    switch (tab) {
      case "LUMPSUM": return calculateLumpSum(num(ls.p), num(ls.r), int(ls.y, 1));
      case "COMPOUND": return calculateCompound(num(ci.p), num(ci.r), int(ci.y, 1), ci.f);
      case "PPF": return calculatePpf(num(ppf.a), 7.1, int(ppf.y, 15));
      case "FD": return calculateFd(num(fd.p), num(fd.r), num(fd.y, 1));
      default: return calculateSip(num(sip.m), num(sip.r), int(sip.y, 1));
    }
  }, [tab, sip, ls, ci, ppf, fd]);
  const title = TABS.find((t) => t.id === tab)!.title;
  const addTo = (cur: string, v: number) => String(Math.trunc(Math.max(0, num(cur) + v)));

  const save = () =>
    saveToHistory(
      {
        category: tab,
        title: `${title} Plan (${money(result.totalValue)})`,
        summary: `Invested: ${money(result.investedAmount)} | Total: ${money(result.totalValue)}`,
        detailsText: `Category: ${title}\nInvested: ${money(result.investedAmount)}\nEstimated Returns: ${money(result.estimatedReturns)}\nTotal Maturity Value: ${money(result.totalValue)}`,
      },
      `${title} saved to history!`,
    );

  return (
    <>
      <TabBar tabs={[...TABS]} value={tab} onChange={(t) => navigate({ search: { tab: t }, replace: true })} scroll />
      <div className="space-y-4 pt-4">
        {tab === "TRADE" ? (
          <TradePnl />
        ) : (
          <>
            <Panel className="space-y-5">
              <SectionTitle title={`${title} Calculator`} action={<Button variant="ghost" size="icon" aria-label="Save investment" onClick={save}><BookmarkPlus /></Button>} />
              {tab === "SIP" && (
                <>
                  <NumberField label="Monthly Investment (SIP)" prefix="₹" value={sip.m} onChange={(m) => setSip({ ...sip, m })} slider={{ min: 500, max: 200000, step: 500, value: num(sip.m), onChange: (v) => setSip({ ...sip, m: String(Math.trunc(v)) }) }} presets={[["+1,000", 1000], ["+5,000", 5000], ["+10,000", 10000], ["+25,000", 25000]]} onPreset={(v) => setSip({ ...sip, m: addTo(sip.m, v) })} />
                  <NumberField label="Expected Return Rate (% p.a.)" suffix="%" value={sip.r} onChange={(r) => setSip({ ...sip, r })} slider={{ min: 1, max: 30, step: 0.1, value: num(sip.r, 12), onChange: (v) => setSip({ ...sip, r: v.toFixed(1) }) }} presets={RATE_PRESETS} onPreset={(v) => setSip({ ...sip, r: v.toFixed(1) })} />
                  <NumberField label="Time Period (Years)" suffix="Yr" value={sip.y} onChange={(y) => setSip({ ...sip, y })} slider={{ min: 1, max: 40, step: 1, value: num(sip.y, 1), onChange: (v) => setSip({ ...sip, y: String(Math.trunc(v)) }) }} presets={[["5 Years", 5], ["10 Years", 10], ["15 Years", 15], ["20 Years", 20]]} onPreset={(v) => setSip({ ...sip, y: String(v) })} />
                </>
              )}
              {tab === "LUMPSUM" && (
                <>
                  <NumberField label="Total Investment Amount" prefix="₹" value={ls.p} onChange={(p) => setLs({ ...ls, p })} slider={{ min: 5000, max: 5000000, step: 5000, value: num(ls.p), onChange: (v) => setLs({ ...ls, p: String(Math.trunc(v)) }) }} presets={[["+25,000", 25000], ["+50,000", 50000], ["+100,000", 100000], ["+500,000", 500000]]} onPreset={(v) => setLs({ ...ls, p: addTo(ls.p, v) })} />
                  <NumberField label="Expected Return Rate (% p.a.)" suffix="%" value={ls.r} onChange={(r) => setLs({ ...ls, r })} slider={{ min: 1, max: 30, step: 0.1, value: num(ls.r, 12), onChange: (v) => setLs({ ...ls, r: v.toFixed(1) }) }} presets={RATE_PRESETS} onPreset={(v) => setLs({ ...ls, r: v.toFixed(1) })} />
                  <NumberField label="Time Period (Years)" suffix="Yr" value={ls.y} onChange={(y) => setLs({ ...ls, y })} slider={{ min: 1, max: 40, step: 1, value: num(ls.y, 1), onChange: (v) => setLs({ ...ls, y: String(Math.trunc(v)) }) }} />
                </>
              )}
              {tab === "COMPOUND" && (
                <>
                  <NumberField label="Principal Deposit" prefix="₹" value={ci.p} onChange={(p) => setCi({ ...ci, p })} slider={{ min: 1000, max: 5000000, step: 1000, value: num(ci.p), onChange: (v) => setCi({ ...ci, p: String(Math.trunc(v)) }) }} />
                  <NumberField label="Annual Interest Rate (%)" suffix="%" value={ci.r} onChange={(r) => setCi({ ...ci, r })} slider={{ min: 1, max: 30, step: 0.1, value: num(ci.r, 8), onChange: (v) => setCi({ ...ci, r: v.toFixed(1) }) }} />
                  <NumberField label="Time Period (Years)" suffix="Yr" value={ci.y} onChange={(y) => setCi({ ...ci, y })} slider={{ min: 1, max: 40, step: 1, value: num(ci.y, 1), onChange: (v) => setCi({ ...ci, y: String(Math.trunc(v)) }) }} />
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Compounding Frequency</p>
                    <ChipRow>{INV_FREQUENCIES.map((f) => <Chip key={f.id} selected={ci.f === f.id} onClick={() => setCi({ ...ci, f: f.id })}>{f.title}</Chip>)}</ChipRow>
                  </div>
                </>
              )}
              {tab === "PPF" && (
                <>
                  <NumberField label="Annual Investment (Max ₹1.5L / yr)" prefix="₹" value={ppf.a} onChange={(a) => setPpf({ ...ppf, a })} slider={{ min: 500, max: 150000, step: 500, value: num(ppf.a), onChange: (v) => setPpf({ ...ppf, a: String(Math.trunc(v)) }) }} presets={[["₹50,000", 50000], ["₹100,000", 100000], ["₹150,000", 150000]]} onPreset={(v) => setPpf({ ...ppf, a: String(v) })} />
                  <NumberField label="Tenure (Statutory 15 Years)" suffix="Yr" value={ppf.y} onChange={(y) => setPpf({ ...ppf, y })} slider={{ min: 15, max: 25, step: 1, value: num(ppf.y, 15), onChange: (v) => setPpf({ ...ppf, y: String(Math.trunc(v)) }) }} />
                  <p className="rounded-2xl bg-primary-soft p-3 text-sm text-primary">Statutory Government PPF interest rate is fixed at 7.1% p.a. (Tax-free under EEE exemption).</p>
                </>
              )}
              {tab === "FD" && (
                <>
                  <NumberField label="Deposit Amount" prefix="₹" value={fd.p} onChange={(p) => setFd({ ...fd, p })} slider={{ min: 5000, max: 5000000, step: 5000, value: num(fd.p), onChange: (v) => setFd({ ...fd, p: String(Math.trunc(v)) }) }} presets={[["+50,000", 50000], ["+100,000", 100000], ["+500,000", 500000]]} onPreset={(v) => setFd({ ...fd, p: addTo(fd.p, v) })} />
                  <NumberField label="Interest Rate (% p.a.)" suffix="%" value={fd.r} onChange={(r) => setFd({ ...fd, r })} slider={{ min: 1, max: 15, step: 0.1, value: num(fd.r, 7.5), onChange: (v) => setFd({ ...fd, r: v.toFixed(1) }) }} />
                  <NumberField label="Tenure Duration (Years)" suffix="Yr" value={fd.y} onChange={(y) => setFd({ ...fd, y })} slider={{ min: 0.5, max: 10, step: 0.5, value: num(fd.y, 1), onChange: (v) => setFd({ ...fd, y: v.toFixed(1) }) }} />
                </>
              )}
            </Panel>

            <Panel className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Total Maturity Value</p>
                <p className="font-display text-4xl font-extrabold text-income tabular-nums">{money(result.totalValue)}</p>
              </div>
              <Donut slices={[{ label: "Invested", value: result.investedAmount, color: "var(--chart-invested)" }, { label: "Wealth Gain", value: result.estimatedReturns, color: "var(--chart-gain)" }]} centerTitle={money(result.totalValue)} centerSubtitle="Total Return" />
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Total Invested" value={money(result.investedAmount)} tone="primary" />
                <Stat label="Est. Returns" value={money(result.estimatedReturns)} tone="income" />
              </div>
            </Panel>

            {result.yearlyBreakdown.length > 0 && (
              <>
                <GrowthChart data={result.yearlyBreakdown} />
                <Panel>
                  <p className="mb-3 font-display font-bold">Yearly Compounding Breakdown</p>
                  <div className="overflow-hidden rounded-2xl border">
                    <table className="w-full text-xs tabular-nums sm:text-sm">
                      <thead className="bg-surface-2 text-muted-foreground"><tr>{["Year", "Invested", "Returns", "Balance"].map((h) => <th key={h} className="px-2 py-2 text-right font-semibold first:text-left">{h}</th>)}</tr></thead>
                      <tbody>
                        {result.yearlyBreakdown.map((y) => (
                          <tr key={y.year} className="border-t">
                            <td className="px-2 py-1.5">Yr {y.year}</td>
                            <td className="px-2 py-1.5 text-right text-chart-invested">{money(y.invested, "")}</td>
                            <td className="px-2 py-1.5 text-right text-chart-gain">{money(y.returns, "")}</td>
                            <td className="px-2 py-1.5 text-right font-bold">{money(y.balance, "")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

function TradePnl() {
  const [intraday, setIntraday] = useState(false);
  const [buy, setBuy] = useState("500");
  const [sell, setSell] = useState("525");
  const [qty, setQty] = useState("100");
  const b = num(buy);
  const s = num(sell);
  const q = /^\d+$/.test(qty) ? parseInt(qty, 10) : 0;
  const valid = b > 0 && s > 0 && q > 0;
  const r = useMemo(() => calculateEquityTradePnl(b, s, q, intraday), [b, s, q, intraday]);
  const profit = r.netPnl >= 0;
  return (
    <>
      <Panel className="space-y-4">
        <SectionTitle title="Trade P&L Calculator" />
        <div className="grid grid-cols-2 gap-2">
          <Chip selected={!intraday} onClick={() => setIntraday(false)} className="justify-center">Delivery (CNC)</Chip>
          <Chip selected={intraday} onClick={() => setIntraday(true)} className="justify-center">Intraday (MIS)</Chip>
        </div>
        <NumberField label="Buy Price" prefix="₹" value={buy} onChange={setBuy} />
        <NumberField label="Sell Price" prefix="₹" value={sell} onChange={setSell} />
        <NumberField label="Quantity (Shares)" value={qty} onChange={setQty} />
      </Panel>
      <Panel className={cn("space-y-2", !valid ? "bg-surface-2" : profit ? "bg-income-soft" : "bg-expense-soft")}>
        <p className={cn("text-xs font-bold tracking-wider", !valid ? "text-muted-foreground" : profit ? "text-income" : "text-expense")}>
          {!valid ? "ENTER VALID TRADE DETAILS" : profit ? "ESTIMATED NET PROFIT" : "ESTIMATED NET LOSS"}
        </p>
        {valid && (
          <>
            <p className={cn("font-display text-3xl font-extrabold tabular-nums", profit ? "text-income" : "text-expense")}>{money(r.netPnl)}</p>
            <div className="divide-y">
              <Row label="Gross P&L" value={money(r.grossPnl)} />
              <Row label="Brokerage Fees" value={money(r.brokerage)} />
              <Row label="STT / CTT" value={money(r.stt)} />
              <Row label="Exchange Txn Charges" value={money(r.exchangeTxnCharge)} />
              <Row label="SEBI Turnover Fee" value={money(r.sebiCharge)} />
              <Row label="Stamp Duty" value={money(r.stampDuty)} />
              <Row label="GST (18%)" value={money(r.gst)} />
              {!intraday && <Row label="DP Charges" value={money(r.dpCharge)} />}
              <Row strong label="Total Government & Broker Charges" value={money(r.totalCharges)} />
              <Row strong label="Breakeven Price per Share" value={money(r.breakevenPerShare)} />
            </div>
          </>
        )}
        <p className="text-xs text-muted-foreground">Estimated charges; actual rates may vary by broker and current regulations.</p>
      </Panel>
    </>
  );
}
