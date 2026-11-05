import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BookmarkPlus, Cake, CalendarDays, CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Chip, ChipRow, NumberField, Panel, Pill, Row, SectionTitle, TabBar } from "@/components/omni/ui";
import { adjustDate, calculateAge, dateDifference, MONTHS, parseISO, plusMonths, toISO, today, WEEKDAYS, dayOfWeek, type LDate } from "@/lib/calc/dates";
import { int } from "@/lib/format";
import { saveToHistory } from "@/lib/history-store";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "AGE", title: "Age Calculator", icon: Cake },
  { id: "DATE_DIFF", title: "Date Difference", icon: CalendarRange },
  { id: "ADD_SUBTRACT", title: "Add / Subtract Days", icon: CalendarDays },
] as const;
type Tab = (typeof TABS)[number]["id"];

export const Route = createFileRoute("/age-calendar")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab | undefined } => ({ tab: TABS.some((t) => t.id === s["tab"]) ? (s["tab"] as Tab) : undefined }),
  head: () => ({
    meta: [
      { title: "Age & Date Calculator — OmniCalc" },
      { name: "description", content: "Exact age and next birthday, days between dates with working days, and add or subtract days from any date." },
      { property: "og:title", content: "Age & Date Calculator — OmniCalc" },
      { property: "og:description", content: "Exact age, date difference and add/subtract days." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AgePage,
});

const long = (d: LDate) => `${String(d.d).padStart(2, "0")} ${MONTHS[d.m - 1]} ${d.y}`;
const grp = (n: number) => n.toLocaleString("en-US");

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const d = parseISO(value);
  return (
    <label className="block rounded-2xl border bg-background px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{d ? long(d) : "Pick a date"}</span>
        <input type="date" value={value} onChange={(e) => e.target.value && onChange(e.target.value)} className="w-9 cursor-pointer bg-transparent text-transparent [color-scheme:light_dark]" aria-label={label} />
      </div>
    </label>
  );
}

function AgePage() {
  const { tab = "AGE" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [init] = useState(() => toISO(today()));
  const [birth, setBirth] = useState("1998-05-15");
  const [asOf, setAsOf] = useState(init);
  const [start, setStart] = useState(init);
  const [end, setEnd] = useState(() => toISO(plusMonths(today(), 1)));
  const [incl, setIncl] = useState(false);
  const [base, setBase] = useState(init);
  const [add, setAdd] = useState(true);
  const [adj, setAdj] = useState({ y: "0", m: "1", w: "2", d: "15" });

  const age = useMemo(() => calculateAge(parseISO(birth)!, parseISO(asOf)!), [birth, asOf]);
  const diff = useMemo(() => dateDifference(parseISO(start)!, parseISO(end)!, incl), [start, end, incl]);
  const res = useMemo(() => adjustDate(parseISO(base)!, add, int(adj.y), int(adj.m), int(adj.w), int(adj.d)), [base, add, adj]);
  const title = TABS.find((t) => t.id === tab)!.title;

  const save = () => {
    const msg = `${title} saved to history!`;
    if (tab === "AGE")
      saveToHistory({ category: "AGE", title: `Age: ${age.years} Years, ${age.months} Mo, ${age.days} Days`, summary: `Born: ${toISO(age.birthDate)} (${age.bornDayOfWeek}) | Next Birthday: in ${age.nextBirthdayMonths}m ${age.nextBirthdayDays}d`, detailsText: `Birth Date: ${toISO(age.birthDate)}\nAge: ${age.years} Years, ${age.months} Months, ${age.days} Days\nTotal Days: ${age.totalDays} days\nNext Birthday: in ${age.nextBirthdayTotalDays} days (${age.nextBirthdayDayOfWeek})` }, msg);
    else if (tab === "DATE_DIFF")
      saveToHistory({ category: "CALENDAR", title: `Date Difference: ${diff.totalDays} Days`, summary: `Between ${toISO(diff.startDate)} and ${toISO(diff.endDate)} (${diff.years}y ${diff.months}m ${diff.days}d)`, detailsText: `From: ${toISO(diff.startDate)}\nTo: ${toISO(diff.endDate)}\nDifference: ${diff.years} Years, ${diff.months} Months, ${diff.days} Days\nWorking Days: ${diff.workingDays}\nWeekend Days: ${diff.weekendDays}` }, msg);
    else {
      const op = res.isAddition ? "Add" : "Subtract";
      saveToHistory({ category: "CALENDAR", title: `Target Date: ${toISO(res.targetDate)} (${res.dayOfWeek})`, summary: `${op} from ${toISO(res.baseDate)}: ${res.years}y ${res.months}m ${res.weeks}w ${res.days}d`, detailsText: `Base Date: ${toISO(res.baseDate)}\nOperation: ${op}\nTarget: ${toISO(res.targetDate)} (${res.dayOfWeek})\nLeap Year: ${res.isLeapYear}` }, msg);
    }
  };
  const saveBtn = <Button variant="ghost" size="icon" aria-label="Save to history" onClick={save}><BookmarkPlus /></Button>;

  return (
    <>
      <TabBar tabs={[...TABS]} value={tab} onChange={(t) => navigate({ search: { tab: t }, replace: true })} />
      <div className="space-y-4 pt-4">
        {tab === "AGE" && (
          <>
            <Panel className="space-y-3">
              <SectionTitle title="Age Calculator" action={saveBtn} />
              <DateField label="Date of Birth" value={birth} onChange={setBirth} />
              <DateField label="Age as of Date" value={asOf} onChange={setAsOf} />
            </Panel>
            <div className="bg-hero space-y-4 rounded-4xl p-5">
              <p className="font-display font-bold">Your Exact Age</p>
              <div className="grid grid-cols-3 gap-3">
                {([[age.years, "Years"], [age.months, "Months"], [age.days, "Days"]] as const).map(([v, l]) => (
                  <div key={l} className="bg-hero-tile rounded-2xl p-3 text-center"><p className="font-display text-3xl font-extrabold">{v}</p><p className="text-xs opacity-80">{l}</p></div>
                ))}
              </div>
              <p className="text-sm opacity-90">Day of birth: {age.bornDayOfWeek}</p>
              <div className="bg-hero-soft flex gap-3 rounded-2xl p-3">
                <Cake className="size-6 shrink-0" />
                <div>
                  <p className="font-bold">Next Birthday</p>
                  <p className="text-sm">In {age.nextBirthdayMonths} Months and {age.nextBirthdayDays} Days ({age.nextBirthdayTotalDays} days total)</p>
                  <p className="text-sm opacity-80">Falls on a {age.nextBirthdayDayOfWeek}</p>
                </div>
              </div>
            </div>
            <Panel className="divide-y">
              <p className="pb-2 font-display font-bold">Total Life Spent</p>
              <Row label="Total Months" value={grp(age.totalMonths)} />
              <Row label="Total Weeks" value={grp(age.totalWeeks)} />
              <Row label="Total Days" value={grp(age.totalDays)} />
              <Row label="Total Hours" value={grp(age.totalHours)} />
              <Row label="Total Minutes" value={grp(age.totalMinutes)} />
            </Panel>
            <Panel className="space-y-2">
              <p className="font-display font-bold">Upcoming Birthdays</p>
              {age.upcomingBirthdays.map((b) => (
                <div key={b.year} className="flex items-center justify-between rounded-2xl bg-surface-2 p-3">
                  <div><p className="font-semibold">{long(b.date)}</p><p className="text-xs text-muted-foreground">{b.dayOfWeek}</p></div>
                  <Pill tone="primary">Turning {b.ageTurning}</Pill>
                </div>
              ))}
            </Panel>
          </>
        )}
        {tab === "DATE_DIFF" && (
          <>
            <Panel className="space-y-3">
              <SectionTitle title="Date Difference Calculator" action={saveBtn} />
              <DateField label="Start Date" value={start} onChange={setStart} />
              <DateField label="End Date" value={end} onChange={setEnd} />
              <div className="flex items-center justify-between rounded-2xl bg-surface-2 p-3">
                <div><p className="font-semibold">Include End Day</p><p className="text-xs text-muted-foreground">Adds 1 day to include the final date</p></div>
                <Switch checked={incl} onCheckedChange={setIncl} />
              </div>
            </Panel>
            <Panel className="space-y-3">
              <p className="text-sm text-muted-foreground">Total Difference</p>
              <p className="font-display text-4xl font-extrabold text-primary">{grp(diff.totalDays)} Days</p>
              <p className="font-semibold">{diff.years} Years, {diff.months} Months, {diff.days} Days</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-income-soft p-3 text-income"><p className="text-xs">Working Days</p><p className="font-bold">{diff.workingDays} Days</p></div>
                <div className="rounded-2xl bg-expense-soft p-3 text-expense"><p className="text-xs">Weekend Days</p><p className="font-bold">{diff.weekendDays} Days</p></div>
              </div>
            </Panel>
          </>
        )}
        {tab === "ADD_SUBTRACT" && (
          <>
            <Panel className="space-y-4">
              <SectionTitle title="Add / Subtract Days" action={saveBtn} />
              <DateField label="Starting Base Date" value={base} onChange={setBase} />
              <p className="text-sm font-semibold">Operation:</p>
              <div className="grid grid-cols-2 gap-2">
                {([[true, "Add (+)"], [false, "Subtract (-)"]] as const).map(([v, l]) => (
                  <button key={l} type="button" onClick={() => setAdd(v)} className={cn("rounded-2xl border p-3 font-semibold", add === v ? "border-primary bg-primary-soft text-primary" : "hover:bg-surface-2")}>{l}</button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Years" value={adj.y} onChange={(y) => setAdj({ ...adj, y })} />
                <NumberField label="Months" value={adj.m} onChange={(m) => setAdj({ ...adj, m })} />
                <NumberField label="Weeks" value={adj.w} onChange={(w) => setAdj({ ...adj, w })} />
                <NumberField label="Days" value={adj.d} onChange={(d) => setAdj({ ...adj, d })} />
              </div>
              <p className="text-sm font-semibold">Quick Warranty / Return Presets:</p>
              <ChipRow>
                {([["7-Day Return", 0, 0, 1, 0], ["30-Day Replacement", 0, 0, 0, 30], ["1-Year Warranty", 1, 0, 0, 0], ["3-Year Warranty", 3, 0, 0, 0]] as const).map(([l, y, m, w, d]) => (
                  <Chip key={l} onClick={() => { setAdd(true); setAdj({ y: String(y), m: String(m), w: String(w), d: String(d) }); }}>{l}</Chip>
                ))}
              </ChipRow>
            </Panel>
            <Panel className="space-y-3">
              <p className="text-sm text-muted-foreground">Target Calculated Date</p>
              <p className="font-display text-2xl font-extrabold text-primary">{WEEKDAYS[dayOfWeek(res.targetDate) - 1]}, {long(res.targetDate)}</p>
              <div className="flex flex-wrap gap-2">
                <Pill tone="primary">{res.isLeapYear ? "Leap Year" : "Normal Year"}</Pill>
                <Pill>{res.daysFromToday > 0 ? `In ${res.daysFromToday} days` : res.daysFromToday < 0 ? `${-res.daysFromToday} days ago` : "Today"}</Pill>
              </div>
            </Panel>
          </>
        )}
      </div>
    </>
  );
}
