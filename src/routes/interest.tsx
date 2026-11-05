import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeftRight, BookmarkPlus, Gauge, Percent, PiggyBank, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Donut } from "@/components/omni/charts";
import { Chip, ChipRow, NumberField, Panel, Row, SectionTitle, TabBar } from "@/components/omni/ui";
import { compoundInterest, doubling, effectiveRate, flatVsReducing, FREQUENCIES, freqTitle, simpleInterest, TIME_UNITS, type CompoundingFrequency, type TimeUnit } from "@/lib/calc/interest";
import { fixed, int, kDouble, money, num } from "@/lib/format";
import { saveToHistory } from "@/lib/history-store";

const TABS = [
  { id: "SIMPLE", title: "Simple Interest", icon: PiggyBank },
  { id: "COMPOUND", title: "Compound Interest", icon: TrendingUp },
  { id: "DOUBLING", title: "Rule of 72", icon: Gauge },
  { id: "EAR", title: "Effective APY", icon: Percent },
  { id: "FLAT_VS_REDUCING", title: "Flat vs Reducing", icon: ArrowLeftRight },
] as const;
type Tab = (typeof TABS)[number]["id"];

export const Route = createFileRoute("/interest")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab | undefined } => ({ tab: TABS.some((t) => t.id === s["tab"]) ? (s["tab"] as Tab) : undefined }),
  head: () => ({
    meta: [
      { title: "Interest Calculator: Simple, Compound, Rule of 72 — OmniCalc" },
      { name: "description", content: "Simple and compound interest, doubling time, effective APY and flat vs reducing rate comparison." },
      { property: "og:title", content: "Interest Calculator — OmniCalc" },
      { property: "og:description", content: "All five interest methods in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InterestPage,
});

function FreqChips({ value, onChange }: { value: CompoundingFrequency; onChange: (f: CompoundingFrequency) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">Compounding Frequency</p>
      <ChipRow>{FREQUENCIES.map((f) => <Chip key={f.id} selected={value === f.id} onClick={() => onChange(f.id)}>{f.title.split(" ")[0]}</Chip>)}</ChipRow>
    </div>
  );
}

function InterestPage() {
  const { tab = "SIMPLE" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [si, setSi] = useState({ p: "100000", r: "8.5", t: "3", u: "YEARS" as TimeUnit });
  const [ci, setCi] = useState({ p: "100000", r: "8.5", y: "5", f: "ANNUALLY" as CompoundingFrequency });
  const [dbl, setDbl] = useState("12");
  const [ear, setEar] = useState({ r: "10", f: "MONTHLY" as CompoundingFrequency });
  const [fr, setFr] = useState({ p: "500000", t: "36", r: "10" });

  const siR = useMemo(() => simpleInterest(num(si.p), num(si.r), num(si.t), si.u), [si]);
  const ciR = useMemo(() => compoundInterest(num(ci.p), num(ci.r), num(ci.y), ci.f), [ci]);
  const dR = useMemo(() => doubling(num(dbl)), [dbl]);
  const eR = useMemo(() => effectiveRate(num(ear.r), ear.f), [ear]);
  const fR = useMemo(() => flatVsReducing(num(fr.p), int(fr.t, 0), num(fr.r)), [fr]);

  const save = () => {
    const m = "Interest calculation saved to history!";
    if (tab === "SIMPLE") saveToHistory({ category: "INTEREST", title: `Simple Interest: ${money(siR.interest)}`, summary: `Principal: ${money(siR.principal)} @ ${kDouble(siR.annualRate)}% for ${si.t} ${TIME_UNITS.find((u) => u.id === si.u)!.title}`, detailsText: `Total Amount: ${money(siR.total)}\nInterest: ${money(siR.interest)}` }, m);
    else if (tab === "COMPOUND") saveToHistory({ category: "INTEREST", title: `Compound Interest: ${money(ciR.totalInterest)}`, summary: `Principal: ${money(ciR.principal)} @ ${kDouble(ciR.annualRate)}% (${freqTitle(ci.f)})`, detailsText: `Total Amount: ${money(ciR.totalAmount)}\nCompounded Interest: ${money(ciR.totalInterest)}` }, m);
    else if (tab === "DOUBLING") saveToHistory({ category: "INTEREST", title: `Rule of 72: Doubling in ${fixed(dR.exactDoublingYears, 1)} Yrs`, summary: `At ${kDouble(dR.annualRate)}% annual return`, detailsText: `Rule of 72: ${fixed(dR.ruleOf72Years, 1)} Yrs\nExact Doubling: ${fixed(dR.exactDoublingYears, 2)} Yrs\nTripling: ${fixed(dR.triplingYears, 2)} Yrs` }, m);
    else if (tab === "EAR") saveToHistory({ category: "INTEREST", title: `Effective APY: ${fixed(eR.effectiveRatePercent, 2)}%`, summary: `Nominal ${kDouble(eR.nominalRate)}% compounded ${freqTitle(ear.f)}`, detailsText: `Extra yield from compounding: +${fixed(eR.extraYieldPercent, 2)}%` }, m);
    else saveToHistory({ category: "INTEREST", title: `Flat ${kDouble(fR.flatRate)}% = Reducing ${fixed(fR.equivalentReducingRate, 2)}%`, summary: `Loan: ${money(fR.principal)} for ${fR.tenureMonths} Mo`, detailsText: `Flat Interest: ${money(fR.flatTotalInterest)}\nTrue Equivalent Reducing Rate: ${fixed(fR.equivalentReducingRate, 2)}%` }, m);
  };
  const saveBtn = <Button variant="ghost" size="icon" aria-label="Save calculation" onClick={save}><BookmarkPlus /></Button>;

  return (
    <>
      <TabBar tabs={[...TABS]} value={tab} onChange={(t) => navigate({ search: { tab: t }, replace: true })} scroll />
      <div className="space-y-4 pt-4">
        {tab === "SIMPLE" && (
          <>
            <Panel className="space-y-4">
              <SectionTitle title="Simple Interest (SI)" action={saveBtn} />
              <NumberField label="Principal Amount" prefix="₹" value={si.p} onChange={(p) => setSi({ ...si, p })} presets={[["+50,000", 50000], ["+100,000", 100000], ["+500,000", 500000]]} onPreset={(v) => setSi({ ...si, p: String(Math.trunc(num(si.p) + v)) })} />
              <NumberField label="Interest Rate (% p.a.)" suffix="%" value={si.r} onChange={(r) => setSi({ ...si, r })} />
              <NumberField label="Time Duration" value={si.t} onChange={(t) => setSi({ ...si, t })} />
              <ChipRow>{TIME_UNITS.map((u) => <Chip key={u.id} selected={si.u === u.id} onClick={() => setSi({ ...si, u: u.id })}>{u.title}</Chip>)}</ChipRow>
            </Panel>
            <Panel className="space-y-4">
              <div className="text-center"><p className="text-sm text-muted-foreground">Total Maturity Amount</p><p className="font-display text-4xl font-extrabold text-primary">{money(siR.total)}</p></div>
              <Donut slices={[{ label: "Principal", value: siR.principal, color: "var(--chart-principal)" }, { label: "Interest Earned", value: siR.interest, color: "var(--chart-interest)" }]} centerTitle={money(siR.interest)} centerSubtitle="Interest Earned" />
            </Panel>
          </>
        )}
        {tab === "COMPOUND" && (
          <>
            <Panel className="space-y-4">
              <SectionTitle title="Compound Interest (CI)" action={saveBtn} />
              <NumberField label="Principal Deposit" prefix="₹" value={ci.p} onChange={(p) => setCi({ ...ci, p })} />
              <NumberField label="Annual Interest Rate (% p.a.)" suffix="%" value={ci.r} onChange={(r) => setCi({ ...ci, r })} />
              <NumberField label="Time Period (Years)" suffix="Years" value={ci.y} onChange={(y) => setCi({ ...ci, y })} />
              <FreqChips value={ci.f} onChange={(f) => setCi({ ...ci, f })} />
            </Panel>
            <Panel className="space-y-2">
              <p className="text-sm text-muted-foreground">Total Compounded Amount</p>
              <p className="font-display text-4xl font-extrabold text-primary">{money(ciR.totalAmount)}</p>
              <Row label="Compound Interest Earned:" value={<span className="text-income">{money(ciR.totalInterest)}</span>} />
            </Panel>
          </>
        )}
        {tab === "DOUBLING" && (
          <>
            <Panel className="space-y-4">
              <SectionTitle title="Rule of 72 & Doubling Time" action={saveBtn} />
              <NumberField label="Annual Return / Interest Rate (% p.a.)" suffix="%" value={dbl} onChange={setDbl} />
            </Panel>
            <Panel className="space-y-2">
              <p className="text-sm text-muted-foreground">Time to Double Your Money</p>
              <p className="font-display text-4xl font-extrabold text-primary">{fixed(dR.exactDoublingYears, 1)} Years</p>
              <p className="text-sm text-muted-foreground">(Rule of 72 Estimate: {fixed(dR.ruleOf72Years, 1)} Years)</p>
              <Row label="Time to Triple (3x):" value={`${fixed(dR.triplingYears, 1)} Years`} />
              <Row label="Time to Quadruple (4x):" value={`${fixed(dR.quadruplingYears, 1)} Years`} />
            </Panel>
          </>
        )}
        {tab === "EAR" && (
          <>
            <Panel className="space-y-4">
              <SectionTitle title="Effective Annual Rate (APY)" action={saveBtn} />
              <NumberField label="Nominal Stated Rate (% p.a.)" suffix="%" value={ear.r} onChange={(r) => setEar({ ...ear, r })} />
              <FreqChips value={ear.f} onChange={(f) => setEar({ ...ear, f })} />
            </Panel>
            <Panel className="space-y-2">
              <p className="text-sm text-muted-foreground">True Effective Annual Rate (APY)</p>
              <p className="font-display text-4xl font-extrabold text-primary">{fixed(eR.effectiveRatePercent, 3)}%</p>
              <p className="text-sm text-income">Extra yield earned: +{fixed(eR.extraYieldPercent, 3)}% due to compounding</p>
            </Panel>
          </>
        )}
        {tab === "FLAT_VS_REDUCING" && (
          <>
            <Panel className="space-y-4">
              <SectionTitle title="Flat vs Reducing Balance Rate" action={saveBtn} />
              <NumberField label="Loan Principal Amount" prefix="₹" value={fr.p} onChange={(p) => setFr({ ...fr, p })} />
              <NumberField label="Loan Tenure (Months)" suffix="Months" value={fr.t} onChange={(t) => setFr({ ...fr, t })} />
              <NumberField label="Lender's Quoted Flat Rate (% p.a.)" suffix="%" value={fr.r} onChange={(r) => setFr({ ...fr, r })} />
            </Panel>
            <Panel className="divide-y">
              <p className="pb-2 font-display font-bold">True Interest Comparison</p>
              <Row label="Quoted Flat Rate:" value={`${kDouble(fR.flatRate)}%`} />
              <Row label="True Reducing Balance Rate:" value={<span className="text-expense">{fixed(fR.equivalentReducingRate, 2)}%</span>} />
              <Row label="Total Interest Paid:" value={money(fR.flatTotalInterest)} />
              <Row label="Monthly Installment (EMI):" value={money(fR.flatMonthlyPayment)} />
            </Panel>
          </>
        )}
      </div>
    </>
  );
}
