// Ported 1:1 from domain/calculator/EmiCalculator.kt and LoanPrepaymentCalculator.kt

export interface PrepaymentEntry {
  month: number;
  amount: number;
}

export interface AmortizationMonth {
  monthIndex: number;
  openingBalance: number;
  emiPaid: number;
  principalPaid: number;
  interestPaid: number;
  prepayment: number;
  closingBalance: number;
}

export interface EmiResult {
  principal: number;
  annualRate: number;
  tenureMonths: number;
  monthlyEmi: number;
  totalInterest: number;
  totalPayment: number;
  schedule: AmortizationMonth[];
  originalTotalInterest: number;
  originalTenureMonths: number;
  interestSaved: number;
  tenureMonthsSaved: number;
}

export function standardEmi(principal: number, annualRate: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  if (annualRate <= 0) return principal / months;
  const r = annualRate / 12 / 100;
  const f = Math.pow(1 + r, months);
  return (principal * r * f) / (f - 1);
}

export function calculateEmi(
  principal: number,
  annualRate: number,
  tenureMonths: number,
  prepayments: PrepaymentEntry[] = [],
): EmiResult {
  if (principal <= 0 || tenureMonths <= 0) {
    return {
      principal,
      annualRate,
      tenureMonths,
      monthlyEmi: 0,
      totalInterest: 0,
      totalPayment: 0,
      schedule: [],
      originalTotalInterest: 0,
      originalTenureMonths: tenureMonths,
      interestSaved: 0,
      tenureMonthsSaved: 0,
    };
  }
  const monthlyRate = annualRate / 12 / 100;
  const emi =
    monthlyRate <= 0
      ? principal / tenureMonths
      : (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
        (Math.pow(1 + monthlyRate, tenureMonths) - 1);

  let baselineBalance = principal;
  let originalTotalInterest = 0;
  for (let m = 1; m <= tenureMonths; m++) {
    const interest = baselineBalance * monthlyRate;
    const pc = Math.min(emi - interest, baselineBalance);
    originalTotalInterest += interest;
    baselineBalance -= pc;
    if (baselineBalance <= 0.001) break;
  }

  const prepayMap = new Map<number, number>();
  for (const p of prepayments) prepayMap.set(p.month, (prepayMap.get(p.month) ?? 0) + p.amount);

  const schedule: AmortizationMonth[] = [];
  let balance = principal;
  let totalInterestPaid = 0;
  let totalPaid = 0;
  let month = 1;
  const maxMonths = tenureMonths * 2;
  while (balance > 0.001 && month <= maxMonths) {
    const opening = balance;
    const interest = monthlyRate > 0 ? opening * monthlyRate : 0;
    const prepay = prepayMap.get(month) ?? 0;
    let emiThis = emi;
    let pc: number;
    if (opening + interest <= emiThis) {
      emiThis = opening + interest;
      pc = opening;
      totalInterestPaid += interest;
      totalPaid += emiThis + prepay;
      const closing = Math.max(0, opening - pc - prepay);
      schedule.push({
        monthIndex: month,
        openingBalance: opening,
        emiPaid: emiThis,
        principalPaid: pc,
        interestPaid: interest,
        prepayment: prepay,
        closingBalance: closing,
      });
      balance = closing;
      break;
    } else {
      pc = emiThis - interest;
      if (pc > opening) {
        pc = opening;
        emiThis = pc + interest;
      }
      const closing = Math.max(0, opening - pc - prepay);
      totalInterestPaid += interest;
      totalPaid += emiThis + prepay;
      schedule.push({
        monthIndex: month,
        openingBalance: opening,
        emiPaid: emiThis,
        principalPaid: pc,
        interestPaid: interest,
        prepayment: prepay,
        closingBalance: closing,
      });
      balance = closing;
    }
    if (balance <= 0.001) break;
    month++;
  }
  const actual = schedule.length;
  return {
    principal,
    annualRate,
    tenureMonths: actual,
    monthlyEmi: emi,
    totalInterest: totalInterestPaid,
    totalPayment: totalPaid,
    schedule,
    originalTotalInterest,
    originalTenureMonths: tenureMonths,
    interestSaved: Math.max(0, originalTotalInterest - totalInterestPaid),
    tenureMonthsSaved: Math.max(0, tenureMonths - actual),
  };
}

const fmt2 = (v: number) =>
  v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function exportAmortizationAsText(r: EmiResult): string {
  const pad = (s: string, n: number) => s.padEnd(n, " ");
  const lines: string[] = [];
  lines.push("=============================================");
  lines.push("           EMI AMORTIZATION SCHEDULE         ");
  lines.push("=============================================");
  lines.push(`Principal Loan Amount : ${fmt2(r.principal)}`);
  lines.push(`Annual Interest Rate  : ${r.annualRate}%`);
  lines.push(`Initial Tenure        : ${r.originalTenureMonths} months`);
  lines.push(`Monthly EMI           : ${fmt2(r.monthlyEmi)}`);
  lines.push(`Total Interest        : ${fmt2(r.totalInterest)}`);
  lines.push(`Total Amount Payable  : ${fmt2(r.totalPayment)}`);
  if (r.interestSaved > 0 || r.tenureMonthsSaved > 0) {
    lines.push("--- Prepayment Benefit ---");
    lines.push(`Tenure Reduced By     : ${r.tenureMonthsSaved} months`);
    lines.push(`Interest Saved        : ${fmt2(r.interestSaved)}`);
  }
  lines.push("");
  lines.push("-".repeat(93));
  lines.push(
    [pad("Month", 5), pad("Opening", 14), pad("EMI", 12), pad("Principal", 12), pad("Interest", 12), pad("Prepay", 12), pad("Closing", 14)].join(" | "),
  );
  lines.push("-".repeat(93));
  for (const m of r.schedule) {
    lines.push(
      [
        pad(String(m.monthIndex), 5),
        pad(fmt2(m.openingBalance), 14),
        pad(fmt2(m.emiPaid), 12),
        pad(fmt2(m.principalPaid), 12),
        pad(fmt2(m.interestPaid), 12),
        pad(m.prepayment > 0 ? fmt2(m.prepayment) : "-", 12),
        pad(fmt2(m.closingBalance), 14),
      ].join(" | "),
    );
  }
  lines.push("=============================================");
  lines.push("Generated via OmniCalc");
  return lines.join("\n");
}

/** Exact cumulative principal paid after `paidMonths` (reducing balance). From LoanRecord.kt */
export function cumulativePrincipal(
  principal: number,
  annualRate: number,
  tenureMonths: number,
  paidMonths: number,
  emi: number,
): number {
  if (principal <= 0 || paidMonths <= 0) return 0;
  if (paidMonths >= tenureMonths) return principal;
  if (annualRate <= 0) return Math.min(principal, (principal / tenureMonths) * paidMonths);
  const r = annualRate / 12 / 100;
  let bal = principal;
  let total = 0;
  for (let m = 1; m <= Math.min(paidMonths, tenureMonths); m++) {
    const i = bal * r;
    const p = Math.min(bal, Math.max(0, emi - i));
    total += p;
    bal = Math.max(0, bal - p);
  }
  return Math.min(principal, total);
}

export interface LoanPrepaymentResult {
  monthsBefore: number;
  monthsAfter: number;
  interestBefore: number;
  interestAfter: number;
  prepaymentApplied: number;
  isForeclosed: boolean;
  isValid: boolean;
  monthsSaved: number;
  interestSaved: number;
}

function amortize(principal: number, monthlyRate: number, emi: number, maxMonths: number) {
  let balance = principal;
  let totalInterest = 0;
  let months = 0;
  while (balance > 0.005 && months < maxMonths) {
    const interest = balance * monthlyRate;
    const payment = Math.min(emi, balance + interest);
    const pp = payment - interest;
    if (pp <= 0) return { months, interest: totalInterest, isPaidOff: false };
    totalInterest += interest;
    balance = Math.max(0, balance - pp);
    months++;
  }
  return { months, interest: totalInterest, isPaidOff: balance <= 0.005 };
}

function mkPrepay(
  monthsBefore: number,
  monthsAfter: number,
  interestBefore: number,
  interestAfter: number,
  prepaymentApplied: number,
  isForeclosed: boolean,
  isValid: boolean,
): LoanPrepaymentResult {
  return {
    monthsBefore,
    monthsAfter,
    interestBefore,
    interestAfter,
    prepaymentApplied,
    isForeclosed,
    isValid,
    monthsSaved: Math.max(0, monthsBefore - monthsAfter),
    interestSaved: Math.max(0, interestBefore - interestAfter),
  };
}

export function calculateLoanPrepayment(
  remainingPrincipal: number,
  annualInterestRate: number,
  monthlyEmi: number,
  remainingMonths: number,
  extraPrepayment: number,
): LoanPrepaymentResult {
  const invalid = mkPrepay(0, 0, 0, 0, 0, false, false);
  if (
    !isFinite(remainingPrincipal) || remainingPrincipal <= 0 ||
    !isFinite(annualInterestRate) || annualInterestRate < 0 ||
    !isFinite(monthlyEmi) || monthlyEmi <= 0 ||
    remainingMonths <= 0 ||
    !isFinite(extraPrepayment) || extraPrepayment < 0
  )
    return invalid;
  const r = annualInterestRate / 1200;
  const original = amortize(remainingPrincipal, r, monthlyEmi, remainingMonths);
  if (!original.isPaidOff) return invalid;
  const applied = Math.min(extraPrepayment, remainingPrincipal);
  const newP = Math.max(0, remainingPrincipal - applied);
  if (newP <= 0.005) return mkPrepay(original.months, 0, original.interest, 0, applied, true, true);
  const after = amortize(newP, r, monthlyEmi, 1200);
  if (!after.isPaidOff) return invalid;
  return mkPrepay(original.months, after.months, original.interest, after.interest, applied, false, true);
}
