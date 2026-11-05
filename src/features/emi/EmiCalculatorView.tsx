import { useMemo, useState } from "react";
import { ArrowLeftRight, BookmarkPlus, FileDown, PartyPopper, Plus, Search, Share2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Donut } from "@/components/omni/charts";
import { Modal, NumberField, Panel, SectionTitle, Stat, TextField } from "@/components/omni/ui";
import { calculateEmi, exportAmortizationAsText, type PrepaymentEntry } from "@/lib/calc/emi";
import { kDouble, money, moneyWhole, num, int } from "@/lib/format";
import { saveToHistory } from "@/lib/history-store";
import { escapeHtml, printReport, shareText } from "@/lib/share";
import { uid } from "@/lib/calc/splitbill";
import { cn } from "@/lib/utils";

type Prepay = PrepaymentEntry & { id: string };

export function EmiCalculatorView() {
  const [principal, setPrincipal] = useState("1000000");
  const [rate, setRate] = useState("8.5");
  const [tenure, setTenure] = useState("10");
  const [years, setYears] = useState(true);
  const [prepays, setPrepays] = useState<Prepay[]>([]);
  const [filter, setFilter] = useState("");
  const [dlg, setDlg] = useState(false);
  const [pm, setPm] = useState("12");
  const [pa, setPa] = useState("50000");

  const totalMonths = years ? Math.trunc(num(tenure) * 12) : Math.trunc(num(tenure));
  const result = useMemo(
    () => calculateEmi(num(principal), num(rate), Math.max(totalMonths, 1), prepays),
    [principal, rate, totalMonths, prepays],
  );
  const rows = useMemo(() => {
    const q = filter.trim();
    if (!q) return result.schedule;
    return result.schedule.filter((r) => String(r.monthIndex).includes(q) || (r.monthIndex % 12 === 0 && "yr".includes(q.toLowerCase())));
  }, [filter, result.schedule]);

  const toggleUnit = () => {
    const cur = num(tenure);
    if (years) setTenure(String(Math.trunc(cur * 12)));
    else setTenure(Math.max(cur / 12, 1).toFixed(1).replace(/\.?0+$/, ""));
    setYears(!years);
  };

  const save = () => {
    let details = `Principal: ${money(result.principal)}\nRate: ${kDouble(result.annualRate)}%\nTenure: ${result.schedule.length} months\nInterest: ${money(result.totalInterest)}\n`;
    if (result.interestSaved > 0) details += `Interest Saved: ${money(result.interestSaved)}\n`;
    saveToHistory(
      {
        category: "EMI",
        title: `Loan EMI (${money(result.principal)} @ ${kDouble(result.annualRate)}%)`,
        summary: `EMI: ${money(result.monthlyEmi)}/mo | Total: ${money(result.totalPayment)}`,
        detailsText: details,
      },
      "EMI calculation saved to history!",
    );
  };

  const exportPdf = () => {
    const r = result;
    const body = `<h1>EMI Amortization Statement</h1><p class="muted">${new Date().toLocaleString()}</p>
      <div class="grid"><div class="box">Loan Amount<b>${escapeHtml(money(r.principal))}</b></div><div class="box">Interest Rate<b>${r.annualRate}% p.a.</b></div>
      <div class="box">Monthly EMI<b>${escapeHtml(money(r.monthlyEmi))}</b></div><div class="box">Tenure<b>${r.schedule.length} months</b></div>
      <div class="box">Total Interest<b>${escapeHtml(money(r.totalInterest))}</b></div><div class="box">Total Payment<b>${escapeHtml(money(r.totalPayment))}</b></div></div>
      ${r.interestSaved > 0 ? `<p><b>Prepayment benefit:</b> Interest saved ${escapeHtml(money(r.interestSaved))}, tenure reduced by ${r.tenureMonthsSaved} months.</p>` : ""}
      <h2>Amortization Schedule</h2><table><tr><th>Month</th><th>Opening</th><th>EMI</th><th>Principal</th><th>Interest</th><th>Prepay</th><th>Closing</th></tr>
      ${r.schedule.map((m) => `<tr><td>${m.monthIndex}</td><td>${moneyWhole(m.openingBalance, "")}</td><td>${moneyWhole(m.emiPaid, "")}</td><td>${moneyWhole(m.principalPaid, "")}</td><td>${moneyWhole(m.interestPaid, "")}</td><td>${m.prepayment > 0 ? moneyWhole(m.prepayment, "") : "-"}</td><td>${moneyWhole(m.closingBalance, "")}</td></tr>`).join("")}</table>`;
    printReport("EMI Amortization Statement - OmniCalc", body);
  };

  return (
    <div className="space-y-4 pt-4">
      <Panel className="space-y-5">
        <SectionTitle
          title="Loan Parameters"
          action={
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" aria-label="Export PDF Statement" onClick={exportPdf}><FileDown /></Button>
              <Button variant="ghost" size="icon" aria-label="Save EMI calculation" onClick={save}><BookmarkPlus /></Button>
              <Button variant="ghost" size="icon" aria-label="Share amortization schedule" onClick={() => shareText(exportAmortizationAsText(result), "EMI Amortization Schedule - OmniCalc")}><Share2 /></Button>
            </div>
          }
        />
        <NumberField
          label="Loan Amount (Principal)" prefix="₹" value={principal} onChange={setPrincipal}
          slider={{ min: 10000, max: 10000000, step: 10000, value: num(principal), onChange: (v) => setPrincipal(String(Math.trunc(v))) }}
          presets={[["+50,000", 50000], ["+100,000", 100000], ["+500,000", 500000], ["+1,000,000", 1000000]]}
          onPreset={(v) => setPrincipal(String(Math.trunc(Math.max(0, num(principal) + v))))}
        />
        <NumberField
          label="Interest Rate (% p.a.)" suffix="%" value={rate} onChange={setRate}
          slider={{ min: 1, max: 30, step: 0.1, value: num(rate, 8.5), onChange: (v) => setRate(v.toFixed(1)) }}
          presets={[["7.0%", 7], ["8.5%", 8.5], ["10.0%", 10], ["12.0%", 12]]}
          onPreset={(v) => setRate(v.toFixed(1))}
        />
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Tenure Duration</span>
            <button type="button" onClick={toggleUnit} className="inline-flex items-center gap-1.5 rounded-full bg-tonal px-3 py-1.5 text-xs font-semibold text-tonal-foreground">
              <ArrowLeftRight className="size-3.5" />
              {years ? "Years (Switch to Mo)" : "Months (Switch to Yr)"}
            </button>
          </div>
          <NumberField
            label={years ? "Tenure in Years" : "Tenure in Months"} suffix={years ? "Years" : "Months"} value={tenure} onChange={setTenure}
            slider={years ? { min: 1, max: 30, step: 1, value: num(tenure, 5), onChange: (v) => setTenure(String(Math.trunc(v))) } : { min: 1, max: 360, step: 1, value: num(tenure, 5), onChange: (v) => setTenure(String(Math.trunc(v))) }}
            presets={years ? [["5 Years", 5], ["10 Years", 10], ["15 Years", 15], ["20 Years", 20]] : [["60 Months", 60], ["120 Months", 120], ["180 Months", 180], ["240 Months", 240]]}
            onPreset={(v) => setTenure(String(v))}
          />
        </div>
      </Panel>

      <Panel className="space-y-4 bg-primary-soft/60">
        <div className="text-center">
          <p className="text-sm font-medium text-muted-foreground">Monthly EMI Payment</p>
          <p className="font-display text-4xl font-extrabold text-primary tabular-nums">{money(result.monthlyEmi)}</p>
        </div>
        <Donut
          slices={[
            { label: "Principal", value: result.principal, color: "var(--chart-principal)" },
            { label: "Total Interest", value: result.totalInterest, color: "var(--chart-interest)" },
          ]}
          centerTitle={money(result.totalPayment)}
          centerSubtitle="Total Payment"
        />
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Total Interest" value={money(result.totalInterest)} tone="expense" />
          <Stat label="Total Amount" value={money(result.totalPayment)} />
        </div>
      </Panel>

      <Panel className="space-y-3">
        <SectionTitle
          title="Pre-Payments & Part-Payments"
          subtitle="Simulate early loan payoffs and interest savings"
          action={<Button variant="tonal" size="sm" onClick={() => setDlg(true)}><Plus /> Add</Button>}
        />
        {(result.interestSaved > 0 || result.tenureMonthsSaved > 0) && (
          <div className="flex gap-3 rounded-2xl bg-income-soft p-3 text-income">
            <PartyPopper className="size-5 shrink-0" />
            <div>
              <p className="font-bold">Savings With Prepayment</p>
              <p className="text-sm">Interest Saved: {money(result.interestSaved)} | Tenure cut by {result.tenureMonthsSaved} months!</p>
            </div>
          </div>
        )}
        {prepays.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-sm font-semibold">Active Prepayments ({prepays.length}):</p>
            {prepays.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2 text-sm">
                <span>Month {p.month}: {money(p.amount)}</span>
                <Button variant="ghost" size="icon" aria-label="Remove prepayment" onClick={() => setPrepays((l) => l.filter((x) => x.id !== p.id))}><Trash2 className="text-destructive" /></Button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel className="space-y-3">
        <SectionTitle
          title="Amortization Schedule"
          subtitle={`${rows.length} months breakdown`}
          action={
            <div className="flex w-36 items-center gap-1 rounded-xl border bg-background px-2">
              <Search className="size-4 text-muted-foreground" />
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter Mo#" className="h-9 w-full bg-transparent text-sm outline-none" />
              {filter && <button type="button" aria-label="Clear search" onClick={() => setFilter("")}><X className="size-4" /></button>}
            </div>
          }
        />
        <div className="max-h-[480px] overflow-auto rounded-2xl border">
          <table className="w-full text-xs tabular-nums sm:text-sm">
            <thead className="sticky top-0 bg-surface-2 text-muted-foreground">
              <tr>
                {["Mo.", "Opening", "Principal", "Interest", "Closing"].map((h) => <th key={h} className="px-2 py-2 text-right font-semibold first:text-left">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.monthIndex} className={cn(r.monthIndex % 2 === 0 && "bg-surface-2/40", r.monthIndex % 12 === 0 && "border-b-2")}>
                  <td className="px-2 py-1.5 font-bold text-primary">
                    {r.monthIndex}
                    {r.prepayment > 0 && <span className="ml-1 block whitespace-nowrap rounded-full bg-income-soft px-1.5 text-[10px] text-income">Part-Payment: {money(r.prepayment)}</span>}
                  </td>
                  <td className="px-2 py-1.5 text-right">{moneyWhole(r.openingBalance, "")}</td>
                  <td className="px-2 py-1.5 text-right text-chart-principal">{moneyWhole(r.principalPaid, "")}</td>
                  <td className="px-2 py-1.5 text-right text-chart-interest">{moneyWhole(r.interestPaid, "")}</td>
                  <td className="px-2 py-1.5 text-right">{moneyWhole(r.closingBalance, "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Modal
        open={dlg}
        onOpenChange={setDlg}
        title="Add Prepayment / Part-Payment"
        description="Enter the month index when you want to make a lump sum prepayment, and the amount."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDlg(false)}>Cancel</Button>
            <Button
              onClick={() => {
                const m = int(pm, 1);
                const a = num(pa);
                if (m > 0 && a > 0) {
                  setPrepays((l) => [...l, { id: uid(), month: m, amount: a }].sort((x, y) => x.month - y.month));
                  setDlg(false);
                }
              }}
            >
              Apply
            </Button>
          </>
        }
      >
        <TextField label={`Month Number (1 to ${result.originalTenureMonths})`} value={pm} onChange={(v) => /^\d*$/.test(v) && setPm(v)} inputMode="numeric" />
        <TextField label="Prepayment Amount (₹)" prefix="₹" value={pa} onChange={(v) => /^\d*\.?\d*$/.test(v) && setPa(v)} inputMode="decimal" />
      </Modal>
    </div>
  );
}
