// Port of domain/backup/FinanceBackupManager.kt + FinanceHubViewModel.restorePayload.
// Reads and writes the same JSON (version 3, app "OmniCalc") as the Android app.
import type {
  BankAccount, CreditCardBillReminder, DebtRecord, ExpenseCategory, ExpenseRecord,
  FinanceData, LoanRecord, SubscriptionRecord, TripRecord,
} from "./types";

export interface BackupPayload {
  categories: ExpenseCategory[];
  bankAccounts: BankAccount[];
  trips: TripRecord[];
  expenses: ExpenseRecord[];
  loans: LoanRecord[];
  debts: DebtRecord[];
  subscriptions: SubscriptionRecord[];
  creditCardReminders: CreditCardBillReminder[];
  creditCardReminderAccountNames: Record<number, string>;
  monthlyBudgetLimit: number | null;
  userUpiId: string | null;
}

export type ParseResult = { ok: true; payload: BackupPayload; summary: string } | { ok: false; message: string };

const pad = (n: number) => String(n).padStart(2, "0");

export function exportToJson(d: FinanceData): string {
  const now = new Date();
  const accName = new Map(d.bankAccounts.map((a) => [a.id, a.bankName]));
  const root: Record<string, unknown> = {
    version: 3,
    app: "OmniCalc",
    exportedAt: now.getTime(),
    exportedAtFormatted: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
    monthlyBudgetLimit: d.monthlyBudgetLimit,
  };
  if (d.userUpiId != null) root["userUpiId"] = d.userUpiId;
  root["categories"] = d.categories.map(({ id, name, colorHex, iconName, isCustom }) => ({ id, name, colorHex, iconName, isCustom }));
  root["bankAccounts"] = d.bankAccounts;
  root["trips"] = d.trips;
  root["expenses"] = d.expenses.map((e) => {
    const o: Record<string, unknown> = {
      id: e.id, title: e.title, amount: e.amount, categoryName: e.categoryName, type: e.type,
      bankAccountId: e.bankAccountId ?? -1, bankAccountName: e.bankAccountName,
      dateTimestamp: e.dateTimestamp, notes: e.notes,
    };
    if (e.loanId != null) o["loanId"] = e.loanId;
    if (e.debtId != null) o["debtId"] = e.debtId;
    if (e.tripId != null) o["tripId"] = e.tripId;
    return o;
  });
  root["loans"] = d.loans;
  root["debts"] = d.debts;
  root["subscriptions"] = d.subscriptions;
  root["creditCardReminders"] = d.creditCardReminders.map((r) => ({ ...r, accountName: accName.get(r.accountId) ?? "" }));
  return JSON.stringify(root, null, 2);
}

export function backupFileName(now = new Date()) {
  return `OmniCalc_Finance_Backup_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.json`;
}

type Obj = Record<string, unknown>;
const str = (o: Obj, k: string, d = "") => (typeof o[k] === "string" ? (o[k] as string) : o[k] == null ? d : String(o[k]));
const numv = (o: Obj, k: string, d = 0) => {
  const v = Number(o[k]);
  return o[k] == null || !isFinite(v) ? d : v;
};
const bool = (o: Obj, k: string, d = false) => (typeof o[k] === "boolean" ? (o[k] as boolean) : o[k] == null ? d : o[k] === "true" || o[k] === 1);
const optId = (o: Obj, k: string) => {
  if (o[k] == null) return null;
  const v = Number(o[k]);
  return isFinite(v) && v > 0 ? v : null;
};
const arr = (root: Obj, k: string): Obj[] => (Array.isArray(root[k]) ? (root[k] as Obj[]).filter((x) => x && typeof x === "object") : []);

export function parseFromJson(json: string): ParseResult {
  if (!json.trim()) return { ok: false, message: "JSON data is empty." };
  let root: Obj;
  try {
    root = JSON.parse(json);
    if (!root || typeof root !== "object" || Array.isArray(root)) throw new Error("Invalid format");
  } catch (e) {
    return { ok: false, message: `Failed to parse JSON file: ${e instanceof Error ? e.message : "Invalid format"}` };
  }
  const categories = arr(root, "categories")
    .filter((o) => str(o, "name").trim())
    .map((o) => ({
      id: numv(o, "id"),
      name: str(o, "name").trim(),
      colorHex: str(o, "colorHex", "#6366F1"),
      iconName: str(o, "iconName", "category"),
      isCustom: bool(o, "isCustom", true),
    }));
  const bankAccounts = arr(root, "bankAccounts")
    .filter((o) => str(o, "bankName").trim())
    .map((o) => ({
      id: numv(o, "id"),
      bankName: str(o, "bankName").trim(),
      accountType: str(o, "accountType", "Savings") || "Savings",
      accountNumber: str(o, "accountNumber"),
      ifscOrRouting: str(o, "ifscOrRouting"),
      holderName: str(o, "holderName"),
      openingBalance: o["openingBalance"] != null ? numv(o, "openingBalance") : numv(o, "balance"),
      balance: numv(o, "balance"),
      notes: str(o, "notes"),
    }));
  const trips = arr(root, "trips")
    .filter((o) => str(o, "tripName").trim())
    .map((o) => ({
      id: numv(o, "id"),
      tripName: str(o, "tripName").trim(),
      destination: str(o, "destination"),
      budget: numv(o, "budget"),
      startDate: str(o, "startDate"),
      endDate: str(o, "endDate"),
      notes: str(o, "notes"),
      categoryCapsJson: str(o, "categoryCapsJson", "{}") || "{}",
    }));
  const expenses = arr(root, "expenses")
    .filter((o) => str(o, "title").trim() || numv(o, "amount") > 0)
    .map((o) => ({
      id: numv(o, "id"),
      title: str(o, "title"),
      amount: numv(o, "amount"),
      categoryName: str(o, "categoryName", "General"),
      type: str(o, "type", "EXPENSE") || "EXPENSE",
      bankAccountId: optId(o, "bankAccountId"),
      bankAccountName: str(o, "bankAccountName"),
      dateTimestamp: numv(o, "dateTimestamp", Date.now()),
      notes: str(o, "notes"),
      tripId: optId(o, "tripId"),
      loanId: optId(o, "loanId"),
      debtId: optId(o, "debtId"),
    }));
  const loans = arr(root, "loans")
    .filter((o) => str(o, "loanName").trim())
    .map((o) => ({
      id: numv(o, "id"),
      loanName: str(o, "loanName").trim(),
      loanCategory: str(o, "loanCategory", "PERSONAL") || "PERSONAL",
      principalAmount: numv(o, "principalAmount"),
      annualInterestRate: numv(o, "annualInterestRate"),
      tenureMonths: Math.trunc(numv(o, "tenureMonths")),
      emiAmount: numv(o, "emiAmount"),
      startDate: str(o, "startDate"),
      paidEmisCount: Math.trunc(numv(o, "paidEmisCount")),
      notes: str(o, "notes"),
      bankAccountId: optId(o, "bankAccountId"),
      bankAccountName: str(o, "bankAccountName"),
      dueDayOfMonth: Math.trunc(numv(o, "dueDayOfMonth", 1)) || 1,
    }));
  const debts = arr(root, "debts")
    .filter((o) => str(o, "personName").trim())
    .map((o) => ({
      id: numv(o, "id"),
      personName: str(o, "personName").trim(),
      amount: numv(o, "amount"),
      type: str(o, "type", "LENT") || "LENT",
      dateTimestamp: numv(o, "dateTimestamp", Date.now()),
      dueDateTimestamp: o["dueDateTimestamp"] != null && numv(o, "dueDateTimestamp") > 0 ? numv(o, "dueDateTimestamp") : null,
      isSettled: bool(o, "isSettled"),
      settledDateTimestamp: o["settledDateTimestamp"] != null && numv(o, "settledDateTimestamp") > 0 ? numv(o, "settledDateTimestamp") : null,
      notes: str(o, "notes"),
      bankAccountId: optId(o, "bankAccountId"),
      bankAccountName: str(o, "bankAccountName"),
    }));
  const subscriptions = arr(root, "subscriptions")
    .filter((o) => str(o, "name").trim())
    .map((o) => ({
      id: numv(o, "id"),
      name: str(o, "name").trim(),
      amount: numv(o, "amount"),
      billingCycle: (str(o, "billingCycle", "MONTHLY") || "MONTHLY").toUpperCase(),
      dueDayOfMonth: Math.trunc(numv(o, "dueDayOfMonth", 1)) || 1,
      dueMonth: Math.trunc(numv(o, "dueMonth", 1)) || 1,
      dueDayOfWeek: Math.trunc(numv(o, "dueDayOfWeek", 1)) || 1,
      categoryName: str(o, "categoryName", "Bills & Utilities"),
      bankAccountId: optId(o, "bankAccountId"),
      bankAccountName: str(o, "bankAccountName"),
      lastPaidTimestamp: numv(o, "lastPaidTimestamp"),
      notes: str(o, "notes"),
    }));
  const creditCardReminderAccountNames: Record<number, string> = {};
  const creditCardReminders = arr(root, "creditCardReminders")
    .filter((o) => numv(o, "accountId") > 0)
    .map((o) => {
      creditCardReminderAccountNames[numv(o, "accountId")] = str(o, "accountName");
      return {
        accountId: numv(o, "accountId"),
        amount: numv(o, "amount"),
        dueDateEpochDay: Math.trunc(numv(o, "dueDateEpochDay")),
        paidDateEpochDay: Math.trunc(numv(o, "paidDateEpochDay", -1)),
        notificationsEnabled: bool(o, "notificationsEnabled", true),
      };
    });
  const monthlyBudgetLimit = root["monthlyBudgetLimit"] != null && isFinite(Number(root["monthlyBudgetLimit"])) ? Number(root["monthlyBudgetLimit"]) : null;
  const userUpiId = typeof root["userUpiId"] === "string" ? root["userUpiId"] : null;

  if (
    !categories.length && !bankAccounts.length && !trips.length && !expenses.length && !loans.length &&
    !debts.length && !subscriptions.length && !creditCardReminders.length && monthlyBudgetLimit == null && userUpiId == null
  )
    return { ok: false, message: "No valid financial data found in JSON." };

  const summary = [
    categories.length ? `${categories.length} Categories` : null,
    bankAccounts.length ? `${bankAccounts.length} Accounts` : null,
    trips.length ? `${trips.length} Trips` : null,
    expenses.length ? `${expenses.length} Expenses` : null,
    loans.length ? `${loans.length} Loans` : null,
    debts.length ? `${debts.length} Debts` : null,
    subscriptions.length ? `${subscriptions.length} Subscriptions` : null,
    creditCardReminders.length ? `${creditCardReminders.length} Card Bills` : null,
    monthlyBudgetLimit != null ? "Budget" : null,
    userUpiId?.trim() ? "UPI ID" : null,
  ]
    .filter(Boolean)
    .join(", ");

  return {
    ok: true,
    summary,
    payload: {
      categories, bankAccounts, trips, expenses, loans, debts, subscriptions,
      creditCardReminders, creditCardReminderAccountNames, monthlyBudgetLimit, userUpiId,
    },
  };
}

/** Merge (dedupe by identity) or replace, remapping ids exactly like restorePayload. */
export function restorePayload(current: FinanceData, p: BackupPayload, replace: boolean): FinanceData {
  const lc = (s: string) => s.trim().toLowerCase();
  const base: FinanceData = replace
    ? { ...current, categories: [], bankAccounts: [], trips: [], expenses: [], loans: [], debts: [], subscriptions: [], creditCardReminders: [] }
    : { ...current };
  let nextId = Math.max(
    current.nextId,
    ...[p.categories, p.bankAccounts, p.trips, p.expenses, p.loans, p.debts, p.subscriptions].flatMap((l) => l.map((x) => x.id + 1)),
    1,
  );
  const usedIds = new Set<number>();
  const takeId = (orig: number) => {
    if (replace && orig > 0 && !usedIds.has(orig)) {
      usedIds.add(orig);
      return orig;
    }
    const id = nextId++;
    usedIds.add(id);
    return id;
  };

  // Accounts
  const accKey = (a: BankAccount) =>
    [lc(a.bankName), lc(a.accountType), lc(a.accountNumber), a.accountNumber.trim() ? "" : lc(a.holderName)].join("|");
  const accounts = [...base.bankAccounts];
  const byIdentity = new Map(accounts.map((a) => [accKey(a), a]));
  const accountIdMap = new Map<number, number>();
  const accountByName = new Map<string, number>();
  accounts.forEach((a) => {
    accountByName.set(lc(a.bankName), a.id);
    accountIdMap.set(a.id, a.id);
  });
  for (const a of p.bankAccounts) {
    const existing = !replace ? byIdentity.get(accKey(a)) : undefined;
    let id = existing?.id;
    if (id == null) {
      id = takeId(a.id);
      accounts.push({ ...a, id });
    }
    if (a.id > 0) accountIdMap.set(a.id, id);
    accountByName.set(lc(a.bankName), id);
  }
  const accName = new Map(accounts.map((a) => [a.id, a.bankName]));
  const mapAcc = (id: number | null, name: string) =>
    (id != null ? accountIdMap.get(id) : undefined) ?? accountByName.get(lc(name)) ?? null;

  // Categories
  const categories = [...base.categories];
  const catNames = new Set(categories.map((c) => lc(c.name)));
  for (const c of p.categories) {
    if (catNames.has(lc(c.name))) continue;
    catNames.add(lc(c.name));
    categories.push({ ...c, id: takeId(c.id) });
  }

  // Trips
  const tripKey = (t: TripRecord) => [lc(t.tripName), lc(t.destination), t.startDate.trim(), t.endDate.trim()].join("|");
  const trips = [...base.trips];
  const tripsBy = new Map(trips.map((t) => [tripKey(t), t]));
  const tripIdMap = new Map<number, number>(trips.map((t) => [t.id, t.id]));
  for (const t of p.trips) {
    const ex = !replace ? tripsBy.get(tripKey(t)) : undefined;
    let id = ex?.id;
    if (id == null) {
      id = takeId(t.id);
      trips.push({ ...t, id });
    }
    if (t.id > 0) tripIdMap.set(t.id, id);
  }

  // Loans
  const loanKey = (l: LoanRecord) =>
    [lc(l.loanName), lc(l.loanCategory), l.principalAmount, l.annualInterestRate, l.tenureMonths, l.emiAmount, l.startDate.trim()].join("|");
  const loans = [...base.loans];
  const loansBy = new Map(loans.map((l) => [loanKey(l), l]));
  const loanIdMap = new Map<number, number>(loans.map((l) => [l.id, l.id]));
  for (const l of p.loans) {
    const ex = !replace ? loansBy.get(loanKey(l)) : undefined;
    let id = ex?.id;
    if (id == null) {
      id = takeId(l.id);
      loans.push({ ...l, id, bankAccountId: mapAcc(l.bankAccountId, l.bankAccountName) });
    }
    if (l.id > 0) loanIdMap.set(l.id, id);
  }

  // Debts
  const debtKey = (d: DebtRecord) =>
    [lc(d.personName), d.amount, d.type.trim().toUpperCase(), d.dateTimestamp, d.dueDateTimestamp, d.isSettled, d.settledDateTimestamp, lc(d.bankAccountName), d.notes.trim()].join("|");
  const debts = [...base.debts];
  const debtsBy = new Map(debts.map((d) => [debtKey(d), d]));
  const debtIdMap = new Map<number, number>(debts.map((d) => [d.id, d.id]));
  for (const d of p.debts) {
    const ex = !replace ? debtsBy.get(debtKey(d)) : undefined;
    let id = ex?.id;
    if (id == null) {
      id = takeId(d.id);
      debts.push({ ...d, id, bankAccountId: mapAcc(d.bankAccountId, d.bankAccountName) });
    }
    if (d.id > 0) debtIdMap.set(d.id, id);
  }

  // Expenses (always inserted, like the Android app)
  const expenses = [...base.expenses];
  for (const e of p.expenses) {
    expenses.push({
      ...e,
      id: takeId(e.id),
      bankAccountId: mapAcc(e.bankAccountId, e.bankAccountName),
      tripId: e.tripId != null ? (tripIdMap.get(e.tripId) ?? null) : null,
      loanId: e.loanId != null ? (loanIdMap.get(e.loanId) ?? null) : null,
      debtId: e.debtId != null ? (debtIdMap.get(e.debtId) ?? null) : null,
    });
  }

  // Subscriptions
  const subKey = (s: SubscriptionRecord) =>
    [lc(s.name), s.amount, lc(s.categoryName), s.billingCycle.trim().toUpperCase(), s.dueDayOfMonth, s.dueMonth, s.dueDayOfWeek, lc(s.bankAccountName), s.lastPaidTimestamp, s.notes.trim()].join("|");
  const subscriptions = [...base.subscriptions];
  const subsBy = new Set(subscriptions.map(subKey));
  for (const s of p.subscriptions) {
    if (!replace && subsBy.has(subKey(s))) continue;
    subscriptions.push({ ...s, id: takeId(s.id), bankAccountId: mapAcc(s.bankAccountId, s.bankAccountName) });
  }

  // Credit-card reminders
  const reminders = [...base.creditCardReminders];
  const remIds = new Set(reminders.map((r) => r.accountId));
  for (const r of p.creditCardReminders) {
    const name = p.creditCardReminderAccountNames[r.accountId] ?? "";
    const target = accountIdMap.get(r.accountId) ?? accountByName.get(lc(name));
    if (target == null || !accName.has(target)) continue;
    if (replace || !remIds.has(target)) {
      remIds.add(target);
      const idx = reminders.findIndex((x) => x.accountId === target);
      const rec = { ...r, accountId: target };
      if (idx >= 0) reminders[idx] = rec;
      else reminders.push(rec);
    }
  }

  const out: FinanceData = {
    ...base,
    bankAccounts: accounts,
    categories,
    trips,
    loans,
    debts,
    expenses,
    subscriptions,
    creditCardReminders: reminders,
    nextId,
  };
  if (replace) {
    out.monthlyBudgetLimit = p.monthlyBudgetLimit ?? 50000;
    out.userUpiId = p.userUpiId;
  }
  return out;
}
