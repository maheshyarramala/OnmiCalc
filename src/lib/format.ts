// Ported from ui/components/CurrencyFormatter.kt (Indian numbering, privacy mode)

let privacy = false;
export const setPrivacyMode = (v: boolean) => {
  privacy = v;
};
export const isPrivacyMode = () => privacy;

export function formatIndianNumber(amount: number, allowDecimals: boolean): string {
  const isNeg = amount < 0;
  const abs = Math.abs(amount);
  const nearest = Math.round(abs);
  const nearWhole = Math.abs(abs - nearest) < 0.005;
  let whole: number;
  let frac: number;
  if (nearWhole || !allowDecimals) {
    whole = nearest;
    frac = 0;
  } else {
    whole = Math.floor(abs);
    frac = Math.floor((abs - whole) * 100 + 0.5);
    if (frac >= 100) {
      whole += 1;
      frac = 0;
    }
  }
  const ws = String(whole);
  let out: string;
  if (ws.length <= 3) out = ws;
  else {
    const last3 = ws.slice(-3);
    const lead = ws.slice(0, -3);
    let lb = "";
    for (let i = 0; i < lead.length; i++) {
      if (i > 0 && (lead.length - i) % 2 === 0) lb += ",";
      lb += lead[i];
    }
    out = `${lb},${last3}`;
  }
  if (isNeg && (whole > 0 || frac > 0)) out = "-" + out;
  if (allowDecimals && frac > 0) out += "." + String(frac).padStart(2, "0");
  return out;
}

function withPrefix(num: string, neg: boolean, prefix: string) {
  if (!prefix) return num;
  return neg ? `-${prefix} ${num.replace(/^-/, "")}` : `${prefix} ${num}`;
}

/** ₹ 1,00,000.50 */
export function money(amount: number, prefix = "₹"): string {
  if (privacy) return "••••••";
  if (!isFinite(amount)) return prefix ? `${prefix} 0` : "0";
  return withPrefix(formatIndianNumber(amount, true), amount < 0, prefix);
}
/** ₹ 1,00,000 */
export function moneyWhole(amount: number, prefix = "₹"): string {
  if (privacy) return "••••••";
  if (!isFinite(amount)) return prefix ? `${prefix} 0` : "0";
  return withPrefix(formatIndianNumber(amount, false), amount < 0, prefix);
}
export function moneyPlain(amount: number): string {
  if (privacy) return "••••••";
  if (!isFinite(amount)) return "0";
  return formatIndianNumber(amount, true);
}

/** en-US grouping with fixed decimals (Java %,.Nf) */
export const fixedGrouped = (v: number, digits = 2) =>
  v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const fixed = (v: number, digits: number) => (isFinite(v) ? v.toFixed(digits) : "0");
/** Kotlin Double.toString-ish: 8.5 -> "8.5", 10 -> "10.0" */
export const kDouble = (v: number) => (Number.isInteger(v) ? v.toFixed(1) : String(v));

export const num = (s: string | undefined | null, fallback = 0) => {
  const v = parseFloat(String(s ?? "").replace(/,/g, ""));
  return isFinite(v) ? v : fallback;
};
export const int = (s: string | undefined | null, fallback = 0) => {
  const t = String(s ?? "").trim();
  if (!/^-?\d+$/.test(t)) return fallback;
  return parseInt(t, 10);
};

export const DECIMAL_INPUT = /^\d*\.?\d*$/;

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** dd MMM, hh:mm a */
export function formatTimestamp(ms: number) {
  const d = new Date(ms);
  const h = d.getHours() % 12 || 12;
  return `${String(d.getDate()).padStart(2, "0")} ${MON[d.getMonth()]}, ${String(h).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")} ${d.getHours() < 12 ? "AM" : "PM"}`;
}
/** dd MMM yyyy */
export function formatDayMonYear(ms: number) {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, "0")} ${MON[d.getMonth()]} ${d.getFullYear()}`;
}
