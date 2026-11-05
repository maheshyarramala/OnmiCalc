// Pure finance rules ported from FinanceRepository.kt / FinanceHubViewModel.kt / LoanRecord.kt.
import { cumulativePrincipal } from "@/lib/calc/emi";
import type { AccountWithBalance, BankAccount, ExpenseRecord, FinanceData, LoanRecord } from "./types";

export const DEFAULT_CATEGORIES = [
  { name: "Food & Dining", colorHex: "#EF4444", iconName: "restaurant" },
  { name: "Shopping", colorHex: "#EC4899", iconName: "shopping_bag" },
  { name: "Fuel & Transport", colorHex: "#F59E0B", iconName: "directions_car" },
  { name: "Bills & Utilities", colorHex: "#3B82F6", iconName: "receipt_long" },
  { name: "Entertainment", colorHex: "#8B5CF6", iconName: "movie" },
  { name: "Health & Medical", colorHex: "#10B981", iconName: "medical_services" },
  { name: "Travel & Trips", colorHex: "#06B6D4", iconName: "flight" },
  { name: "Investments", colorHex: "#4F46E5", iconName: "trending_up" },
];

export function initialFinanceData(): FinanceData {
  let id = 1;
  const categories = DEFAULT_CATEGORIES.map((c) => ({ id: id++, ...c, isCustom: false }));
  const acc = (bankName: string, accountType: string): BankAccount => ({
    id: id++,
    bankName,
    accountType,
    accountNumber: "",
    ifscOrRouting: "",
    holderName: "",
    openingBalance: 0,
    balance: 0,
    notes: "",
  });
  const bankAccounts = [acc("Primary Bank", "Savings"), acc("Cash Wallet", "Cash")];
  return {
    categories,
    bankAccounts,
    trips: [],
    expenses: [],
    loans: [],
    debts: [],
    subscriptions: [],
    creditCardReminders: [],
    monthlyBudgetLimit: 50000,
    userUpiId: null,
    nextId: id,
  };
}

const isOut = (t: string) => t === "EXPENSE" || t === "TRANSFER_OUT";
const isIn = (t: string) => t === "INCOME" || t === "TRANSFER_IN";

export function accountsWithBalances(accounts: BankAccount[], expenses: ExpenseRecord[]): AccountWithBalance[] {
  return accounts.map((account) => {
    let inc = 0;
    let exp = 0;
    for (const e of expenses) {
      if (e.bankAccountId !== account.id) continue;
      if (isOut(e.type)) exp += e.amount;
      else if (isIn(e.type)) inc += e.amount;
    }
    return {
      account,
      openingBalance: account.openingBalance,
      totalIncome: inc,
      totalExpense: exp,
      currentBalance: account.openingBalance + inc - exp,
    };
  });
}

export const totalIncome = (expenses: ExpenseRecord[]) =>
  expenses.filter((e) => e.type === "INCOME").reduce((s, e) => s + e.amount, 0);
export const totalExpense = (expenses: ExpenseRecord[]) =>
  expenses.filter((e) => e.type === "EXPENSE").reduce((s, e) => s + e.amount, 0);

export function isCurrentMonth(ms: number, now = new Date()) {
  const d = new Date(ms);
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}
export const currentMonthExpenses = (expenses: ExpenseRecord[], now = new Date()) =>
  expenses.filter((e) => e.type === "EXPENSE" && isCurrentMonth(e.dateTimestamp, now)).reduce((s, e) => s + e.amount, 0);

export function currentMonthCategorySpend(
  expenses: ExpenseRecord[],
  categories: { name: string; colorHex: string }[],
  now = new Date(),
) {
  const month = expenses.filter((e) => e.type === "EXPENSE" && isCurrentMonth(e.dateTimestamp, now));
  const total = month.reduce((s, e) => s + e.amount, 0);
  const colors = new Map(categories.map((c) => [c.name, c.colorHex]));
  const groups = new Map<string, number>();
  for (const e of month) groups.set(e.categoryName, (groups.get(e.categoryName) ?? 0) + e.amount);
  return [...groups.entries()]
    .map(([categoryName, totalAmount]) => ({
      categoryName,
      colorHex: colors.get(categoryName) ?? "#6366F1",
      totalAmount,
      percentage: total > 0 ? (totalAmount / total) * 100 : 0,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
}

export function budgetStatus(spent: number, limit: number) {
  const ratio = limit > 0 ? spent / limit : 0;
  return {
    ratio,
    progress: Math.min(1, Math.max(0, ratio)),
    over80: ratio >= 0.8 && ratio < 1,
    over100: ratio >= 1,
    remaining: limit - spent,
    percent: Math.trunc(ratio * 100),
  };
}

// ---- Loans (LoanRecord derived getters) ----
export function loanStats(l: LoanRecord) {
  const remainingEmis = Math.max(0, l.tenureMonths - l.paidEmisCount);
  const totalRepayment = l.emiAmount * l.tenureMonths;
  const principalPaid = cumulativePrincipal(l.principalAmount, l.annualInterestRate, l.tenureMonths, l.paidEmisCount, l.emiAmount);
  const isFullyPaid = l.paidEmisCount >= l.tenureMonths;
  return {
    remainingEmis,
    totalRepayment,
    totalInterestPayable: Math.max(0, totalRepayment - l.principalAmount),
    totalPaidAmount: l.emiAmount * Math.min(l.paidEmisCount, l.tenureMonths),
    progress: l.tenureMonths > 0 ? Math.min(1, Math.max(0, l.paidEmisCount / l.tenureMonths)) : 0,
    principalPaid,
    remainingPrincipal: Math.max(0, l.principalAmount - principalPaid),
    isFullyPaid,
    monthlyOutflow: isFullyPaid ? 0 : l.emiAmount,
  };
}

/** Smart Liquid Fund Guard from payLoanEmi / settleDebt */
export function pickFundedAccount(
  balances: AccountWithBalance[],
  preferredId: number | null,
  amount: number,
): AccountWithBalance | undefined {
  if (preferredId != null) {
    const t = balances.find((a) => a.account.id === preferredId);
    if (t && t.currentBalance < amount) return balances.find((a) => a.currentBalance >= amount) ?? t;
    if (t) return t;
  }
  return balances.find((a) => a.currentBalance >= amount) ?? balances[0];
}

/** Matching counterpart for a transfer leg (FinanceHubScreen delete dialog). */
export function findLinkedTransfers(e: ExpenseRecord, all: ExpenseRecord[]): ExpenseRecord[] {
  const lc = (s: string) => s.trim().toLowerCase();
  if (e.type === "TRANSFER_OUT" && e.title.startsWith("Transfer to ")) {
    const toName = lc(e.title.slice("Transfer to ".length));
    return all.filter(
      (x) =>
        x.id !== e.id &&
        x.type === "TRANSFER_IN" &&
        Math.abs(x.amount - e.amount) < 0.005 &&
        Math.abs(x.dateTimestamp - e.dateTimestamp) <= 1 &&
        lc(x.title) === lc(`Transfer from ${e.bankAccountName}`) &&
        lc(x.bankAccountName) === toName,
    );
  }
  if (e.type === "TRANSFER_IN" && e.title.startsWith("Transfer from ")) {
    const fromName = lc(e.title.slice("Transfer from ".length));
    return all.filter(
      (x) =>
        x.id !== e.id &&
        x.type === "TRANSFER_OUT" &&
        Math.abs(x.amount - e.amount) < 0.005 &&
        Math.abs(x.dateTimestamp - e.dateTimestamp) <= 1 &&
        lc(x.title) === lc(`Transfer to ${e.bankAccountName}`) &&
        lc(x.bankAccountName) === fromName,
    );
  }
  return [];
}

// ---- Trips ----
export function parseTripDate(s: string): Date | null {
  const t = s.trim();
  let m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(t);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return null;
}

export function parseCaps(json: string): Record<string, number> {
  try {
    const o = JSON.parse(json || "{}");
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(o)) if (typeof v === "number" || typeof v === "string") out[k] = Number(v) || 0;
    return out;
  } catch {
    return {};
  }
}

export function tripStats(trip: { budget: number; startDate: string; endDate: string; categoryCapsJson: string; id: number }, expenses: ExpenseRecord[], now = new Date()) {
  const tripExpenses = expenses.filter((e) => e.tripId === trip.id);
  const spent = tripExpenses.reduce((s, e) => s + e.amount, 0);
  const progress = trip.budget > 0 ? Math.min(1, Math.max(0, spent / trip.budget)) : 0;
  const start = parseTripDate(trip.startDate);
  const end = parseTripDate(trip.endDate);
  const dayMs = 86400000;
  const totalDays = start && end ? Math.max(1, Math.round((end.getTime() - start.getTime()) / dayMs) + 1) : 7;
  const dailyBudget = totalDays > 0 ? trip.budget / totalDays : trip.budget / 7;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const elapsed = start ? Math.max(1, Math.round((today.getTime() - start.getTime()) / dayMs) + 1) : 1;
  const dailyRate = spent / elapsed;
  const burn = dailyBudget > 0 ? dailyRate / dailyBudget : 0;
  const caps = parseCaps(trip.categoryCapsJson);
  const capRows = Object.entries(caps).map(([category, cap]) => {
    const catSpent = tripExpenses
      .filter((e) => e.categoryName.trim().toLowerCase() === category.trim().toLowerCase())
      .reduce((s, e) => s + e.amount, 0);
    return { category, cap, spent: catSpent, over: catSpent > cap };
  });
  return {
    tripExpenses,
    spent,
    progress,
    over: spent > trip.budget,
    totalDays,
    dailyBudget,
    elapsed,
    dailyRate,
    burn,
    exceeding: burn > 1.05,
    capRows,
  };
}

export const isCreditCard = (a: BankAccount) => a.accountType.trim().toLowerCase() === "credit card";
