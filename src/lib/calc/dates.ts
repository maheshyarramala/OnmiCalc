// Java LocalDate-style helpers (timezone-safe via UTC math) plus ports of
// AgeCalculator.kt, CalendarCalculator.kt and SubscriptionDueDateCalculator.kt

export interface LDate {
  y: number;
  m: number; // 1-12
  d: number;
}

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));

export const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
export const lengthOfMonth = (y: number, m: number) =>
  [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1] ?? 30;

export const toEpochDay = (d: LDate) => Math.floor(Date.UTC(d.y, d.m - 1, d.d) / 86400000);
export const fromEpochDay = (n: number): LDate => {
  const dt = new Date(n * 86400000);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
};
export const today = (): LDate => {
  const n = new Date();
  return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
};
export const fromMillis = (ms: number): LDate => {
  const n = new Date(ms);
  return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
};
export const toMillis = (d: LDate) => new Date(d.y, d.m - 1, d.d, 12).getTime();
export const parseISO = (s: string): LDate | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s?.trim() ?? "");
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
};
export const toISO = (d: LDate) =>
  `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
export const cmp = (a: LDate, b: LDate) => toEpochDay(a) - toEpochDay(b);
export const daysBetween = (a: LDate, b: LDate) => toEpochDay(b) - toEpochDay(a);
/** 1 = Monday .. 7 = Sunday */
export const dayOfWeek = (d: LDate) => {
  const js = new Date(Date.UTC(d.y, d.m - 1, d.d)).getUTCDay();
  return js === 0 ? 7 : js;
};
export const weekdayName = (d: LDate) => WEEKDAYS[dayOfWeek(d) - 1];
export const plusDays = (d: LDate, n: number) => fromEpochDay(toEpochDay(d) + n);
export const plusMonths = (d: LDate, n: number): LDate => {
  const total = d.y * 12 + (d.m - 1) + n;
  const y = Math.floor(total / 12);
  const m = (total % 12 + 12) % 12 + 1;
  return { y, m, d: Math.min(d.d, lengthOfMonth(y, m)) };
};
export const plusYears = (d: LDate, n: number): LDate => {
  const y = d.y + n;
  return { y, m: d.m, d: Math.min(d.d, lengthOfMonth(y, d.m)) };
};
export const withYear = (d: LDate, y: number): LDate => ({ y, m: d.m, d: Math.min(d.d, lengthOfMonth(y, d.m)) });
export const withDayOfMonth = (d: LDate, day: number): LDate => ({ ...d, d: day });
export const formatLDate = (d: LDate) => `${String(d.d).padStart(2, "0")} ${MONTHS_SHORT[d.m - 1]} ${d.y}`;

/** java.time.Period.between */
export function periodBetween(a: LDate, b: LDate) {
  let totalMonths = b.y * 12 + b.m - (a.y * 12 + a.m);
  let days = b.d - a.d;
  if (totalMonths > 0 && days < 0) {
    totalMonths--;
    const calc = plusMonths(a, totalMonths);
    days = toEpochDay(b) - toEpochDay(calc);
  } else if (totalMonths < 0 && days > 0) {
    totalMonths++;
    days -= lengthOfMonth(b.y, b.m);
  }
  return { years: Math.trunc(totalMonths / 12), months: totalMonths % 12, days };
}
/** ChronoUnit.MONTHS.between */
export function monthsBetween(a: LDate, b: LDate) {
  let months = b.y * 12 + b.m - (a.y * 12 + a.m);
  if (months > 0 && b.d < a.d) months--;
  else if (months < 0 && b.d > a.d) months++;
  return months;
}

// ---------------- Age ----------------
export function calculateAge(birth: LDate, target: LDate = today()) {
  const period = periodBetween(birth, target);
  const totalDays = Math.max(0, daysBetween(birth, target));
  const totalMonths = Math.max(0, monthsBetween(birth, target));
  let next = withYear(birth, target.y);
  if (cmp(next, target) <= 0) next = withYear(birth, target.y + 1);
  const nextPeriod = periodBetween(target, next);
  const upcoming = Array.from({ length: 5 }, (_, i) => {
    const yr = next.y + i;
    const b = withYear(birth, yr);
    return { year: yr, date: b, dayOfWeek: weekdayName(b), ageTurning: yr - birth.y };
  });
  return {
    birthDate: birth,
    targetDate: target,
    years: Math.max(0, period.years),
    months: Math.max(0, period.months),
    days: Math.max(0, period.days),
    totalMonths,
    totalWeeks: Math.floor(totalDays / 7),
    totalDays,
    totalHours: totalDays * 24,
    totalMinutes: totalDays * 24 * 60,
    totalSeconds: totalDays * 24 * 3600,
    bornDayOfWeek: weekdayName(birth),
    nextBirthdayMonths: Math.max(0, nextPeriod.months),
    nextBirthdayDays: Math.max(0, nextPeriod.days),
    nextBirthdayTotalDays: daysBetween(target, next),
    nextBirthdayDayOfWeek: weekdayName(next),
    upcomingBirthdays: upcoming,
  };
}

// ---------------- Calendar ----------------
export function dateDifference(start: LDate, end: LDate, includeEndDay = false) {
  const s = cmp(start, end) > 0 ? end : start;
  const e = cmp(start, end) > 0 ? start : end;
  const adjEnd = includeEndDay ? plusDays(e, 1) : e;
  const totalDays = daysBetween(s, adjEnd);
  const period = periodBetween(s, adjEnd);
  let working = 0;
  let weekend = 0;
  const startDow = dayOfWeek(s);
  for (let i = 0; i < totalDays; i++) {
    const dow = ((startDow - 1 + i) % 7) + 1;
    if (dow >= 6) weekend++;
    else working++;
  }
  return {
    startDate: s,
    endDate: e,
    includeEndDay,
    years: period.years,
    months: period.months,
    days: period.days,
    totalDays,
    weeks: Math.floor(totalDays / 7),
    remainingDays: totalDays % 7,
    workingDays: working,
    weekendDays: weekend,
    totalHours: totalDays * 24,
  };
}

export function adjustDate(base: LDate, isAddition: boolean, years = 0, months = 0, weeks = 0, days = 0) {
  const sign = isAddition ? 1 : -1;
  let r = plusYears(base, sign * years);
  r = plusMonths(r, sign * months);
  r = plusDays(r, sign * (weeks * 7 + days));
  return {
    baseDate: base,
    isAddition,
    years,
    months,
    weeks,
    days,
    targetDate: r,
    dayOfWeek: weekdayName(r),
    isLeapYear: isLeap(r.y),
    daysFromToday: daysBetween(today(), r),
  };
}

// ---------------- Subscriptions ----------------
export interface SubscriptionLike {
  billingCycle: string;
  dueDayOfMonth: number;
  dueMonth: number;
  dueDayOfWeek: number;
  lastPaidTimestamp: number;
}
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const previousOrSame = (d: LDate, dow: number) => plusDays(d, -((dayOfWeek(d) - dow + 7) % 7));
const nextOrSame = (d: LDate, dow: number) => plusDays(d, (dow - dayOfWeek(d) + 7) % 7);

export function isPaidInCurrentCycle(s: SubscriptionLike, t: LDate = today()): boolean {
  if (s.lastPaidTimestamp <= 0) return false;
  const lp = fromMillis(s.lastPaidTimestamp);
  const cycle = s.billingCycle.toUpperCase();
  if (cycle === "WEEKLY") {
    const start = previousOrSame(t, clamp(s.dueDayOfWeek, 1, 7));
    return cmp(lp, start) >= 0 && cmp(lp, t) <= 0;
  }
  if (cycle === "YEARLY") return lp.y === t.y;
  return lp.y === t.y && lp.m === t.m;
}

export function nextDueDate(s: SubscriptionLike, t: LDate = today()): LDate {
  const dueDay = clamp(s.dueDayOfMonth, 1, 31);
  const lp = s.lastPaidTimestamp > 0 ? fromMillis(s.lastPaidTimestamp) : null;
  const cycle = s.billingCycle.toUpperCase();
  if (cycle === "WEEKLY") {
    const wd = clamp(s.dueDayOfWeek, 1, 7);
    const nd = nextOrSame(t, wd);
    if (cmp(nd, t) === 0 && lp) {
      const start = previousOrSame(t, wd);
      if (cmp(lp, start) >= 0 && cmp(lp, t) <= 0) return plusDays(nd, 7);
    }
    return nd;
  }
  if (cycle === "YEARLY") {
    const mv = clamp(s.dueMonth, 1, 12);
    let due: LDate = { y: t.y, m: mv, d: Math.min(dueDay, lengthOfMonth(t.y, mv)) };
    if (lp?.y === t.y || cmp(due, t) < 0) due = plusYears(due, 1);
    return due;
  }
  const thisMonth: LDate = { y: t.y, m: t.m, d: Math.min(dueDay, lengthOfMonth(t.y, t.m)) };
  const alreadyPaid = !!lp && lp.y === t.y && lp.m === t.m;
  if (alreadyPaid || cmp(thisMonth, t) < 0) {
    const nm = plusMonths({ ...t, d: 1 }, 1);
    return { y: nm.y, m: nm.m, d: Math.min(dueDay, lengthOfMonth(nm.y, nm.m)) };
  }
  return thisMonth;
}
