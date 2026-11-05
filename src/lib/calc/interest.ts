// Ported 1:1 from domain/calculator/InterestCalculator.kt

export type TimeUnit = "YEARS" | "MONTHS" | "DAYS";
export const TIME_UNITS: { id: TimeUnit; title: string }[] = [
  { id: "YEARS", title: "Years" },
  { id: "MONTHS", title: "Months" },
  { id: "DAYS", title: "Days" },
];

export type CompoundingFrequency = "ANNUALLY" | "SEMI_ANNUALLY" | "QUARTERLY" | "MONTHLY" | "DAILY";
export const FREQUENCIES: { id: CompoundingFrequency; title: string; timesPerYear: number }[] = [
  { id: "ANNUALLY", title: "Annually (1/yr)", timesPerYear: 1 },
  { id: "SEMI_ANNUALLY", title: "Semi-Annually (2/yr)", timesPerYear: 2 },
  { id: "QUARTERLY", title: "Quarterly (4/yr)", timesPerYear: 4 },
  { id: "MONTHLY", title: "Monthly (12/yr)", timesPerYear: 12 },
  { id: "DAILY", title: "Daily (365/yr)", timesPerYear: 365 },
];
export const freqTimes = (f: CompoundingFrequency) =>
  FREQUENCIES.find((x) => x.id === f)?.timesPerYear ?? 1;
export const freqTitle = (f: CompoundingFrequency) => FREQUENCIES.find((x) => x.id === f)?.title ?? f;

export function simpleInterest(principal: number, annualRate: number, timeValue: number, unit: TimeUnit) {
  if (principal <= 0 || annualRate <= 0 || timeValue <= 0)
    return { principal, annualRate, timeYears: 0, interest: 0, total: principal };
  const timeYears = unit === "YEARS" ? timeValue : unit === "MONTHS" ? timeValue / 12 : timeValue / 365;
  const interest = (principal * annualRate * timeYears) / 100;
  return { principal, annualRate, timeYears, interest, total: principal + interest };
}

export interface YearlyGrowth {
  year: number;
  interestEarnedSoFar: number;
  balance: number;
}

export function compoundInterest(
  principal: number,
  annualRate: number,
  timeYears: number,
  frequency: CompoundingFrequency,
) {
  if (principal <= 0 || annualRate <= 0 || timeYears <= 0)
    return { principal, annualRate, timeYears, frequency, totalAmount: principal, totalInterest: 0, yearlyBreakdown: [] as YearlyGrowth[] };
  const n = freqTimes(frequency);
  const r = annualRate / 100 / n;
  const totalAmount = principal * Math.pow(1 + r, n * timeYears);
  const totalInterest = Math.max(0, totalAmount - principal);
  const whole = Math.max(1, Math.trunc(timeYears));
  const yearly: YearlyGrowth[] = [];
  for (let y = 1; y <= whole; y++) {
    const bal = principal * Math.pow(1 + r, n * y);
    yearly.push({ year: y, interestEarnedSoFar: Math.max(0, bal - principal), balance: bal });
  }
  return { principal, annualRate, timeYears, frequency, totalAmount, totalInterest, yearlyBreakdown: yearly };
}

export function doubling(annualRate: number) {
  if (annualRate <= 0)
    return { annualRate, ruleOf72Years: 0, exactDoublingYears: 0, triplingYears: 0, quadruplingYears: 0 };
  const r = annualRate / 100;
  return {
    annualRate,
    ruleOf72Years: 72 / annualRate,
    exactDoublingYears: Math.log(2) / Math.log(1 + r),
    triplingYears: Math.log(3) / Math.log(1 + r),
    quadruplingYears: Math.log(4) / Math.log(1 + r),
  };
}

export function effectiveRate(nominalRate: number, frequency: CompoundingFrequency) {
  if (nominalRate <= 0) return { nominalRate, frequency, effectiveRatePercent: 0, extraYieldPercent: 0 };
  const n = freqTimes(frequency);
  const ear = (Math.pow(1 + nominalRate / 100 / n, n) - 1) * 100;
  return { nominalRate, frequency, effectiveRatePercent: ear, extraYieldPercent: Math.max(0, ear - nominalRate) };
}

export function flatVsReducing(principal: number, tenureMonths: number, flatRatePercent: number) {
  if (principal <= 0 || tenureMonths <= 0 || flatRatePercent <= 0)
    return {
      principal, tenureMonths, flatRate: flatRatePercent,
      flatTotalInterest: 0, flatMonthlyPayment: 0, equivalentReducingRate: 0,
      reducingTotalInterest: 0, reducingMonthlyPayment: 0,
    };
  const years = tenureMonths / 12;
  const flatInterest = (principal * flatRatePercent * years) / 100;
  const flatEmi = (principal + flatInterest) / tenureMonths;
  const mr = flatRatePercent / 12 / 100;
  const f = Math.pow(1 + mr, tenureMonths);
  const reducingEmi = (principal * mr * f) / (f - 1);
  return {
    principal,
    tenureMonths,
    flatRate: flatRatePercent,
    flatTotalInterest: flatInterest,
    flatMonthlyPayment: flatEmi,
    equivalentReducingRate: ((2 * tenureMonths) / (tenureMonths + 1)) * flatRatePercent,
    reducingTotalInterest: reducingEmi * tenureMonths - principal,
    reducingMonthlyPayment: reducingEmi,
  };
}
