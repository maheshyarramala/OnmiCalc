// Ported from CurrencyCalculator.kt, UnitConverter.kt, UtilityCalculators.kt

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  flag: string;
  ratePerUsd: number;
}

export const DEFAULT_CURRENCIES: CurrencyInfo[] = [
  { code: "USD", name: "US Dollar", symbol: "$", flag: "🇺🇸", ratePerUsd: 1.0 },
  { code: "INR", name: "Indian Rupee", symbol: "₹", flag: "🇮🇳", ratePerUsd: 86.85 },
  { code: "EUR", name: "Euro", symbol: "€", flag: "🇪🇺", ratePerUsd: 0.952 },
  { code: "GBP", name: "British Pound", symbol: "£", flag: "🇬🇧", ratePerUsd: 0.795 },
  { code: "AED", name: "UAE Dirham", symbol: "AED", flag: "🇦🇪", ratePerUsd: 3.6725 },
  { code: "SAR", name: "Saudi Riyal", symbol: "﷼", flag: "🇸🇦", ratePerUsd: 3.75 },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", flag: "🇯🇵", ratePerUsd: 152.8 },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", flag: "🇨🇦", ratePerUsd: 1.405 },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", flag: "🇦🇺", ratePerUsd: 1.542 },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF", flag: "🇨🇭", ratePerUsd: 0.902 },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", flag: "🇨🇳", ratePerUsd: 7.285 },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", flag: "🇸🇬", ratePerUsd: 1.348 },
  { code: "KWD", name: "Kuwaiti Dinar", symbol: "KD", flag: "🇰🇼", ratePerUsd: 0.3075 },
  { code: "QAR", name: "Qatari Riyal", symbol: "QR", flag: "🇶🇦", ratePerUsd: 3.64 },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", flag: "🇲🇾", ratePerUsd: 4.45 },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", flag: "🇳🇿", ratePerUsd: 1.72 },
  { code: "KRW", name: "South Korean Won", symbol: "₩", flag: "🇰🇷", ratePerUsd: 1420.0 },
  { code: "BRL", name: "Brazilian Real", symbol: "R$", flag: "🇧🇷", ratePerUsd: 5.75 },
];

export function convertSingle(amount: number, from: string, to: string, rates: Record<string, number>) {
  return (amount / (rates[from] ?? 1)) * (rates[to] ?? 1);
}

export function convertToAll(amount: number, base: string, currencies: CurrencyInfo[], rates: Record<string, number>) {
  const baseRate = rates[base] ?? 1;
  const usd = amount / baseRate;
  return currencies.map((c) => {
    const tr = rates[c.code] ?? c.ratePerUsd;
    return { info: c, convertedAmount: usd * tr, exchangeRateFromBase: tr / baseRate };
  });
}

export type UnitCategory = "LENGTH" | "WEIGHT" | "TEMPERATURE" | "CURRENCY";
export interface UnitItem {
  id: string;
  name: string;
  symbol: string;
  factorToBase: number;
}
export const UNIT_CATEGORIES: { id: UnitCategory; title: string }[] = [
  { id: "LENGTH", title: "Length" },
  { id: "WEIGHT", title: "Weight & Mass" },
  { id: "TEMPERATURE", title: "Temperature" },
  { id: "CURRENCY", title: "Currency" },
];
export const UNITS: Record<UnitCategory, UnitItem[]> = {
  LENGTH: [
    { id: "m", name: "Meter", symbol: "m", factorToBase: 1 },
    { id: "km", name: "Kilometer", symbol: "km", factorToBase: 1000 },
    { id: "cm", name: "Centimeter", symbol: "cm", factorToBase: 0.01 },
    { id: "mm", name: "Millimeter", symbol: "mm", factorToBase: 0.001 },
    { id: "mi", name: "Mile", symbol: "mi", factorToBase: 1609.344 },
    { id: "yd", name: "Yard", symbol: "yd", factorToBase: 0.9144 },
    { id: "ft", name: "Foot", symbol: "ft", factorToBase: 0.3048 },
    { id: "in", name: "Inch", symbol: "in", factorToBase: 0.0254 },
  ],
  WEIGHT: [
    { id: "kg", name: "Kilogram", symbol: "kg", factorToBase: 1 },
    { id: "g", name: "Gram", symbol: "g", factorToBase: 0.001 },
    { id: "mg", name: "Milligram", symbol: "mg", factorToBase: 0.000001 },
    { id: "t", name: "Metric Ton", symbol: "t", factorToBase: 1000 },
    { id: "lb", name: "Pound", symbol: "lb", factorToBase: 0.45359237 },
    { id: "oz", name: "Ounce", symbol: "oz", factorToBase: 0.028349523 },
  ],
  TEMPERATURE: [
    { id: "C", name: "Celsius", symbol: "°C", factorToBase: 1 },
    { id: "F", name: "Fahrenheit", symbol: "°F", factorToBase: 1 },
    { id: "K", name: "Kelvin", symbol: "K", factorToBase: 1 },
  ],
  CURRENCY: [
    { id: "USD", name: "US Dollar", symbol: "$", factorToBase: 1 },
    { id: "EUR", name: "Euro", symbol: "€", factorToBase: 0.92 },
    { id: "GBP", name: "British Pound", symbol: "£", factorToBase: 0.79 },
    { id: "INR", name: "Indian Rupee", symbol: "₹", factorToBase: 86.4 },
    { id: "JPY", name: "Japanese Yen", symbol: "¥", factorToBase: 154.2 },
    { id: "CAD", name: "Canadian Dollar", symbol: "C$", factorToBase: 1.38 },
    { id: "AUD", name: "Australian Dollar", symbol: "A$", factorToBase: 1.52 },
    { id: "CHF", name: "Swiss Franc", symbol: "CHF", factorToBase: 0.88 },
    { id: "CNY", name: "Chinese Yuan", symbol: "¥", factorToBase: 7.24 },
    { id: "AED", name: "UAE Dirham", symbol: "AED", factorToBase: 3.67 },
  ],
};

export function convertUnit(cat: UnitCategory, value: number, from: UnitItem, to: UnitItem) {
  if (cat === "TEMPERATURE") {
    const c = from.id === "F" ? ((value - 32) * 5) / 9 : from.id === "K" ? value - 273.15 : value;
    return to.id === "F" ? (c * 9) / 5 + 32 : to.id === "K" ? c + 273.15 : c;
  }
  if (cat === "CURRENCY") return (value / from.factorToBase) * to.factorToBase;
  return (value * from.factorToBase) / to.factorToBase;
}

export interface NoCostEmiAnalysis {
  productPrice: number;
  upfrontMerchantDiscount: number;
  effectiveLoanPrincipal: number;
  monthlyBaseEmi: number;
  totalInterestComponent: number;
  gstOnInterest18Percent: number;
  processingFeeWithGst: number;
  totalHiddenCost: number;
  actualTotalOutflow: number;
  effectiveAnnualCostPercent: number;
}

export function calculateTrueNoCostEmi(
  productPrice: number,
  annualBankRatePercent = 16,
  tenureMonths = 6,
  processingFee = 199,
  gstRatePercent = 18,
): NoCostEmiAnalysis {
  const zero: NoCostEmiAnalysis = {
    productPrice: 0, upfrontMerchantDiscount: 0, effectiveLoanPrincipal: 0, monthlyBaseEmi: 0,
    totalInterestComponent: 0, gstOnInterest18Percent: 0, processingFeeWithGst: 0,
    totalHiddenCost: 0, actualTotalOutflow: 0, effectiveAnnualCostPercent: 0,
  };
  tenureMonths = Math.trunc(tenureMonths);
  if (
    !isFinite(productPrice) || productPrice <= 0 || !isFinite(annualBankRatePercent) || annualBankRatePercent < 0 ||
    tenureMonths <= 0 || !isFinite(processingFee) || processingFee < 0 || !isFinite(gstRatePercent) || gstRatePercent < 0
  )
    return zero;
  const r = annualBankRatePercent / 1200;
  const base = productPrice / tenureMonths;
  const eff = r === 0 ? productPrice : (base * (Math.pow(1 + r, tenureMonths) - 1)) / (r * Math.pow(1 + r, tenureMonths));
  if (!isFinite(eff)) return zero;
  const disc = Math.max(0, productPrice - eff);
  const g = gstRatePercent / 100;
  const gstOnInt = disc * g;
  const pf = processingFee * (1 + g);
  const hidden = gstOnInt + pf;
  const outflow = productPrice + hidden;
  const annual = (hidden / productPrice) * (12 / tenureMonths) * 100;
  if (!isFinite(hidden) || !isFinite(outflow) || !isFinite(annual)) return zero;
  return {
    productPrice,
    upfrontMerchantDiscount: disc,
    effectiveLoanPrincipal: eff,
    monthlyBaseEmi: base,
    totalInterestComponent: disc,
    gstOnInterest18Percent: gstOnInt,
    processingFeeWithGst: pf,
    totalHiddenCost: hidden,
    actualTotalOutflow: outflow,
    effectiveAnnualCostPercent: annual,
  };
}

export function calculateSplit(billAmount: number, numPersons: number) {
  const persons = Math.max(1, Math.trunc(numPersons));
  if (billAmount <= 0) return { billAmount: 0, numPersons: persons, perPersonShare: 0 };
  return { billAmount, numPersons: persons, perPersonShare: billAmount / persons };
}

export function calculateTip(billAmount: number, tipPercent = 0, numPersons = 1) {
  const persons = Math.max(1, Math.trunc(numPersons));
  if (billAmount <= 0)
    return { billAmount: 0, tipPercent, numPersons: persons, tipAmount: 0, totalAmount: 0, perPersonTip: 0, perPersonTotal: 0 };
  const tip = billAmount * (tipPercent / 100);
  const total = billAmount + tip;
  return { billAmount, tipPercent, numPersons: persons, tipAmount: tip, totalAmount: total, perPersonTip: tip / persons, perPersonTotal: total / persons };
}

export function calculateGst(amount: number, ratePercent: number, isExclusive: boolean) {
  if (amount <= 0)
    return { initialAmount: 0, ratePercent, isExclusive, baseAmount: 0, gstAmount: 0, cgstAmount: 0, sgstAmount: 0, finalTotalAmount: 0 };
  if (isExclusive) {
    const gst = amount * (ratePercent / 100);
    return { initialAmount: amount, ratePercent, isExclusive: true, baseAmount: amount, gstAmount: gst, cgstAmount: gst / 2, sgstAmount: gst / 2, finalTotalAmount: amount + gst };
  }
  const base = amount / (1 + ratePercent / 100);
  const gst = amount - base;
  return { initialAmount: amount, ratePercent, isExclusive: false, baseAmount: base, gstAmount: gst, cgstAmount: gst / 2, sgstAmount: gst / 2, finalTotalAmount: amount };
}
