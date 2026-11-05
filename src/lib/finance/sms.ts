// Port of domain/finance/BankSmsParser.kt — on the web the user pastes the SMS text.
import type { BankAccount } from "./types";

export interface ParsedSms {
  amount: number;
  isIncome: boolean;
  merchantOrTitle: string;
  suggestedCategory: string;
  matchedAccountId: number | null;
  matchedAccountName: string;
  rawNotes: string;
}

const amountRe = /(?:Rs\.?|INR|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i;
const vpaRe = /(?:to|at|towards|from|info:?|vpa)\s+([A-Za-z0-9._@-]+(?:\s+[A-Za-z0-9._-]+)?)/i;
const acctRe = /(?:a\/c|acct|card|xx+|ending)\s*(?:no\.?\s*)?[xX*]*([0-9]{3,4})/i;

export function parseSms(sms: string, accounts: BankAccount[]): ParsedSms | null {
  const clean = sms.trim();
  if (!clean) return null;
  const am = amountRe.exec(clean);
  if (!am) return null;
  const amount = parseFloat((am[1] ?? "").replace(/,/g, ""));
  if (!isFinite(amount) || amount <= 0) return null;
  const lower = clean.toLowerCase();
  const has = (...k: string[]) => k.some((x) => lower.includes(x));
  const isIncome = has("credited", "received", "deposited", "refund") && !lower.includes("debited");
  let merchant = "UPI / Bank Txn";
  const vm = vpaRe.exec(clean);
  if (vm) {
    let raw = (vm[1] ?? "").trim();
    const at = raw.indexOf("@");
    if (at >= 0) raw = raw.slice(0, at);
    raw = raw.replace(/[^A-Za-z0-9 ]/g, " ").trim();
    merchant = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "UPI Payment";
  }
  const category = has("swiggy", "zomato", "restaurant", "cafe", "biryani")
    ? "Food & Dining"
    : has("amazon", "flipkart", "myntra", "mart")
      ? "Shopping"
      : has("irctc", "uber", "ola", "rapido", "petrol", "fuel")
        ? "Fuel & Transport"
        : has("netflix", "bookmyshow", "prime", "spotify", "movie")
          ? "Entertainment"
          : has("zerodha", "dhan", "angel", "groww", "mutual fund")
            ? "Investments"
            : has("apollo", "pharma", "hospital", "med")
              ? "Health & Medical"
              : "Bills & Utilities";
  let matched: BankAccount | undefined;
  const lm = acctRe.exec(clean);
  const last4 = lm?.[1];
  if (last4) matched = accounts.find((a) => a.accountNumber && a.accountNumber.endsWith(last4));
  if (!matched) matched = accounts.find((a) => lower.includes(a.bankName.toLowerCase())) ?? accounts[0];
  return {
    amount,
    isIncome,
    merchantOrTitle: merchant,
    suggestedCategory: category,
    matchedAccountId: matched?.id ?? null,
    matchedAccountName: matched?.bankName ?? "",
    rawNotes: "Auto-parsed from SMS",
  };
}

export function incomeCategoryFor(sms: string) {
  const l = sms.toLowerCase();
  if (l.includes("salary") || l.includes("payroll")) return "Salary";
  if (l.includes("freelance")) return "Freelance";
  if (l.includes("business")) return "Business";
  if (l.includes("investment") || l.includes("interest")) return "Investment";
  if (l.includes("bonus")) return "Bonus";
  if (l.includes("gift")) return "Gift";
  return "Other";
}
