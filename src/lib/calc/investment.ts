// Ported 1:1 from domain/calculator/InvestmentCalculators.kt

export interface YearlyBreakdown {
  year: number;
  invested: number;
  returns: number;
  balance: number;
}
export interface InvestmentResult {
  title: string;
  investedAmount: number;
  estimatedReturns: number;
  totalValue: number;
  yearlyBreakdown: YearlyBreakdown[];
}

export type InvFrequency = "ANNUALLY" | "SEMI_ANNUALLY" | "QUARTERLY" | "MONTHLY";
export const INV_FREQUENCIES: { id: InvFrequency; title: string; timesPerYear: number }[] = [
  { id: "ANNUALLY", title: "Annually", timesPerYear: 1 },
  { id: "SEMI_ANNUALLY", title: "Semi-Annually", timesPerYear: 2 },
  { id: "QUARTERLY", title: "Quarterly", timesPerYear: 4 },
  { id: "MONTHLY", title: "Monthly", timesPerYear: 12 },
];
const invFreq = (f: InvFrequency) => INV_FREQUENCIES.find((x) => x.id === f)!;

const empty = (title: string): InvestmentResult => ({
  title,
  investedAmount: 0,
  estimatedReturns: 0,
  totalValue: 0,
  yearlyBreakdown: [],
});

export function calculateSip(monthly: number, annualRate: number, years: number): InvestmentResult {
  if (monthly <= 0 || years <= 0) return empty("SIP");
  const r = annualRate / 12 / 100;
  const fv = (months: number) =>
    r <= 0 ? monthly * months : monthly * ((Math.pow(1 + r, months) - 1) / r) * (1 + r);
  const invested = monthly * years * 12;
  const total = fv(years * 12);
  const yb: YearlyBreakdown[] = [];
  for (let y = 1; y <= years; y++) {
    const inv = monthly * y * 12;
    const v = fv(y * 12);
    yb.push({ year: y, invested: inv, returns: Math.max(0, v - inv), balance: v });
  }
  return {
    title: "SIP Investment",
    investedAmount: invested,
    estimatedReturns: Math.max(0, total - invested),
    totalValue: total,
    yearlyBreakdown: yb,
  };
}

export function calculateLumpSum(initial: number, annualRate: number, years: number): InvestmentResult {
  if (initial <= 0 || years <= 0) return empty("Lump Sum");
  const r = annualRate / 100;
  const total = initial * Math.pow(1 + r, years);
  const yb: YearlyBreakdown[] = [];
  for (let y = 1; y <= years; y++) {
    const v = initial * Math.pow(1 + r, y);
    yb.push({ year: y, invested: initial, returns: Math.max(0, v - initial), balance: v });
  }
  return {
    title: "Lump Sum",
    investedAmount: initial,
    estimatedReturns: Math.max(0, total - initial),
    totalValue: total,
    yearlyBreakdown: yb,
  };
}

export function calculateCompound(
  principal: number,
  annualRate: number,
  years: number,
  frequency: InvFrequency,
): InvestmentResult {
  if (principal <= 0 || years <= 0) return empty("Compound Interest");
  const f = invFreq(frequency);
  const r = annualRate / 100 / f.timesPerYear;
  const yb: YearlyBreakdown[] = [];
  for (let y = 1; y <= years; y++) {
    const v = principal * Math.pow(1 + r, f.timesPerYear * y);
    yb.push({ year: y, invested: principal, returns: Math.max(0, v - principal), balance: v });
  }
  const total = yb.at(-1)?.balance ?? principal;
  return {
    title: `Compound Interest (${f.title})`,
    investedAmount: principal,
    estimatedReturns: Math.max(0, total - principal),
    totalValue: total,
    yearlyBreakdown: yb,
  };
}

export function calculatePpf(annualDeposit: number, annualRate = 7.1, years = 15): InvestmentResult {
  if (annualDeposit <= 0 || years <= 0) return empty("PPF");
  const r = annualRate / 100;
  let balance = 0;
  let invested = 0;
  const yb: YearlyBreakdown[] = [];
  for (let y = 1; y <= years; y++) {
    invested += annualDeposit;
    const opening = balance + annualDeposit;
    balance = opening + opening * r;
    yb.push({ year: y, invested, returns: balance - invested, balance });
  }
  return {
    title: "PPF Account",
    investedAmount: invested,
    estimatedReturns: Math.max(0, balance - invested),
    totalValue: balance,
    yearlyBreakdown: yb,
  };
}

export function calculateFd(
  deposit: number,
  annualRate: number,
  years: number,
  frequency: InvFrequency = "QUARTERLY",
): InvestmentResult {
  if (deposit <= 0 || years <= 0) return empty("Fixed Deposit");
  const n = invFreq(frequency).timesPerYear;
  const r = annualRate / 100 / n;
  const total = deposit * Math.pow(1 + r, n * years);
  const whole = Math.max(1, Math.trunc(years));
  const yb: YearlyBreakdown[] = [];
  for (let y = 1; y <= whole; y++) {
    const v = deposit * Math.pow(1 + r, n * y);
    yb.push({ year: y, invested: deposit, returns: Math.max(0, v - deposit), balance: v });
  }
  return {
    title: "Fixed Deposit (FD)",
    investedAmount: deposit,
    estimatedReturns: Math.max(0, total - deposit),
    totalValue: total,
    yearlyBreakdown: yb,
  };
}

export interface StockAverageResult {
  totalQuantity: number;
  totalInvested: number;
  averagePrice: number;
  targetSellPrice: number;
  netProfitAtTarget: number;
}

export function calculateStockAverage(
  qty1: number,
  price1: number,
  qty2: number,
  price2: number,
  currentMarketPrice = 0,
): StockAverageResult {
  const q1 = Math.max(0, Math.trunc(qty1));
  const q2 = Math.max(0, Math.trunc(qty2));
  const zero = { totalQuantity: 0, totalInvested: 0, averagePrice: 0, targetSellPrice: 0, netProfitAtTarget: 0 };
  const tq = q1 + q2;
  if (
    tq === 0 || tq > 2147483647 ||
    (q1 > 0 && (!isFinite(price1) || price1 <= 0)) ||
    (q2 > 0 && (!isFinite(price2) || price2 <= 0))
  )
    return zero;
  const inv = q1 * price1 + q2 * price2;
  if (!isFinite(inv)) return zero;
  const target = isFinite(currentMarketPrice) && currentMarketPrice > 0 ? currentMarketPrice : 0;
  return {
    totalQuantity: tq,
    totalInvested: inv,
    averagePrice: inv / tq,
    targetSellPrice: target,
    netProfitAtTarget: target > 0 ? target * tq - inv : 0,
  };
}

export interface TradeChargeBreakdown {
  grossPnl: number;
  brokerage: number;
  stt: number;
  exchangeTxnCharge: number;
  sebiCharge: number;
  stampDuty: number;
  gst: number;
  dpCharge: number;
  totalCharges: number;
  netPnl: number;
  breakevenPerShare: number;
}

export function calculateEquityTradePnl(
  buyPrice: number,
  sellPrice: number,
  quantity: number,
  isIntraday: boolean,
  brokerageFlatOrMax = 20,
  dpChargeOnDeliverySell = 15.34,
): TradeChargeBreakdown {
  const zero: TradeChargeBreakdown = {
    grossPnl: 0, brokerage: 0, stt: 0, exchangeTxnCharge: 0, sebiCharge: 0,
    stampDuty: 0, gst: 0, dpCharge: 0, totalCharges: 0, netPnl: 0, breakevenPerShare: 0,
  };
  quantity = Math.trunc(quantity);
  if (
    !isFinite(buyPrice) || buyPrice <= 0 || !isFinite(sellPrice) || sellPrice <= 0 || quantity <= 0 ||
    !isFinite(brokerageFlatOrMax) || brokerageFlatOrMax < 0 ||
    !isFinite(dpChargeOnDeliverySell) || dpChargeOnDeliverySell < 0
  )
    return zero;
  const buyT = buyPrice * quantity;
  const sellT = sellPrice * quantity;
  const tot = buyT + sellT;
  if (!isFinite(tot)) return zero;
  const gross = sellT - buyT;
  const brokerage = isIntraday
    ? Math.min(buyT * 0.0003, brokerageFlatOrMax) + Math.min(sellT * 0.0003, brokerageFlatOrMax)
    : 0;
  const stt = isIntraday ? sellT * 0.00025 : tot * 0.001;
  const exch = tot * 0.0000297;
  const sebi = tot * 0.000001;
  const stamp = isIntraday ? buyT * 0.00003 : buyT * 0.00015;
  const gst = (brokerage + exch + sebi) * 0.18;
  const dp = isIntraday ? 0 : dpChargeOnDeliverySell;
  const total = brokerage + stt + exch + sebi + stamp + gst + dp;
  return {
    grossPnl: gross,
    brokerage,
    stt,
    exchangeTxnCharge: exch,
    sebiCharge: sebi,
    stampDuty: stamp,
    gst,
    dpCharge: dp,
    totalCharges: total,
    netPnl: gross - total,
    breakevenPerShare: buyPrice + total / quantity,
  };
}
