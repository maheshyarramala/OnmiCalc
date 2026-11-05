// On-device finance store (replaces the Android Room database). Persisted to localStorage.
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { standardEmi } from "@/lib/calc/emi";
import { toEpochDay, today } from "@/lib/calc/dates";
import { accountsWithBalances, initialFinanceData, loanStats, pickFundedAccount } from "./logic";
import { restorePayload, type BackupPayload } from "./backup";
import type {
  BankAccount, CreditCardBillReminder, DebtRecord, ExpenseRecord, FinanceData, LoanRecord,
  SubscriptionRecord, TripRecord,
} from "./types";

type Result = { ok: true; message: string } | { ok: false; message: string };

export interface FinanceActions {
  addCategory(name: string, colorHex: string): void;
  deleteCategory(id: number): void;
  addExpense(e: Omit<ExpenseRecord, "id" | "tripId" | "loanId" | "debtId" | "dateTimestamp"> & Partial<Pick<ExpenseRecord, "tripId" | "loanId" | "debtId" | "dateTimestamp">>): number;
  updateExpense(id: number, patch: Pick<ExpenseRecord, "title" | "amount" | "categoryName">): void;
  deleteExpenses(ids: number[]): ExpenseRecord[];
  restoreExpenses(list: ExpenseRecord[]): void;
  transfer(fromId: number, toId: number, amount: number, notes: string): Result;
  addBankAccount(a: Omit<BankAccount, "id" | "balance">): void;
  updateOpeningBalance(id: number, opening: number): void;
  deleteBankAccount(id: number): void;
  saveCardReminder(r: CreditCardBillReminder): void;
  markCardPaid(accountId: number): void;
  deleteCardReminder(accountId: number): void;
  addTrip(t: Omit<TripRecord, "id" | "categoryCapsJson">): void;
  deleteTrip(id: number): void;
  setTripCap(id: number, category: string, cap: number): void;
  removeTripCap(id: number, category: string): void;
  addSubscription(s: Omit<SubscriptionRecord, "id" | "lastPaidTimestamp">): void;
  deleteSubscription(id: number): void;
  paySubscription(id: number, accountId: number | null): Result;
  setBudget(limit: number): void;
  setUpiId(upi: string | null): void;
  addLoan(l: Omit<LoanRecord, "id" | "emiAmount" | "startDate"> & { emiAmount?: number }): void;
  deleteLoan(id: number): void;
  payLoanEmi(id: number, preferredAccountId: number | null): Result & { expenseId?: number };
  undoLoanEmi(id: number, expenseId?: number | null): Result;
  addDebt(d: Omit<DebtRecord, "id" | "dateTimestamp" | "isSettled" | "settledDateTimestamp">, adjust: boolean): void;
  settleDebt(id: number, accountId: number | null, adjust: boolean): Result;
  deleteDebt(id: number): void;
  restoreBackup(p: BackupPayload, replace: boolean): void;
  resetAll(): void;
}

export type FinanceStore = FinanceData & FinanceActions;

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const useFinance = create<FinanceStore>()(
  persist(
    (set, get) => {
      const nid = () => {
        const id = get().nextId;
        set({ nextId: id + 1 });
        return id;
      };
      const balances = () => accountsWithBalances(get().bankAccounts, get().expenses);
      const insertExpense = (e: Omit<ExpenseRecord, "id">) => {
        const id = nid();
        set((s) => ({ expenses: [{ ...e, id }, ...s.expenses] }));
        return id;
      };
      const loanName = (title: string) => title.split("EMI:")[1]?.split("(#")[0]?.trim() ?? "";
      const bumpLoan = (id: number, delta: number) =>
        set((s) => ({
          loans: s.loans.map((l) =>
            l.id === id
              ? { ...l, paidEmisCount: delta > 0 ? (l.paidEmisCount < l.tenureMonths ? l.paidEmisCount + 1 : l.paidEmisCount) : Math.max(0, l.paidEmisCount - 1) }
              : l,
          ),
        }));
      const sideEffects = (e: ExpenseRecord, restoring: boolean) => {
        if (e.loanId != null) bumpLoan(e.loanId, restoring ? 1 : -1);
        else if (e.title.startsWith("EMI:")) {
          const n = loanName(e.title);
          const loan = n ? get().loans.find((l) => l.loanName === n) : undefined;
          if (loan) bumpLoan(loan.id, restoring ? 1 : -1);
        }
        if (e.debtId != null)
          set((s) => ({
            debts: s.debts.map((d) =>
              d.id === e.debtId ? { ...d, isSettled: restoring, settledDateTimestamp: restoring ? Date.now() : null } : d,
            ),
          }));
      };

      return {
        ...initialFinanceData(),

        addCategory: (name, colorHex) =>
          set((s) => ({ categories: [...s.categories, { id: s.nextId, name: name.trim(), colorHex, iconName: "category", isCustom: true }], nextId: s.nextId + 1 })),
        deleteCategory: (id) => set((s) => ({ categories: s.categories.filter((c) => c.id !== id) })),

        addExpense: (e) =>
          insertExpense({ tripId: null, loanId: null, debtId: null, dateTimestamp: Date.now(), ...e }),
        updateExpense: (id, patch) =>
          set((s) => ({ expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...patch, title: patch.title.trim() } : e)) })),
        deleteExpenses: (ids) => {
          const removed = get().expenses.filter((e) => ids.includes(e.id));
          set((s) => ({ expenses: s.expenses.filter((e) => !ids.includes(e.id)) }));
          removed.forEach((e) => sideEffects(e, false));
          return removed;
        },
        restoreExpenses: (list) => {
          set((s) => ({ expenses: [...list, ...s.expenses].sort((a, b) => b.dateTimestamp - a.dateTimestamp) }));
          list.forEach((e) => sideEffects(e, true));
        },
        transfer: (fromId, toId, amount, notes) => {
          if (!(amount > 0)) return { ok: false, message: "Enter a transfer amount greater than zero." };
          if (fromId === toId) return { ok: false, message: "Choose two different accounts to transfer between." };
          const from = get().bankAccounts.find((a) => a.id === fromId);
          const to = get().bankAccounts.find((a) => a.id === toId);
          if (!from || !to) return { ok: false, message: "Choose two existing accounts to transfer between." };
          const t = Date.now();
          insertExpense({ title: `Transfer to ${to.bankName}`, amount, categoryName: "Transfer", type: "TRANSFER_OUT", bankAccountId: from.id, bankAccountName: from.bankName, dateTimestamp: t, notes, tripId: null, loanId: null, debtId: null });
          insertExpense({ title: `Transfer from ${from.bankName}`, amount, categoryName: "Transfer", type: "TRANSFER_IN", bankAccountId: to.id, bankAccountName: to.bankName, dateTimestamp: t + 1, notes, tripId: null, loanId: null, debtId: null });
          return { ok: true, message: `Transferred ₹${Math.trunc(amount)} from ${from.bankName} to ${to.bankName}` };
        },

        addBankAccount: (a) => {
          const id = nid();
          set((s) => ({ bankAccounts: [...s.bankAccounts, { ...a, id, bankName: a.bankName.trim(), balance: a.openingBalance }] }));
        },
        updateOpeningBalance: (id, opening) =>
          set((s) => ({ bankAccounts: s.bankAccounts.map((a) => (a.id === id ? { ...a, openingBalance: opening } : a)) })),
        deleteBankAccount: (id) =>
          set((s) => ({
            bankAccounts: s.bankAccounts.filter((a) => a.id !== id),
            creditCardReminders: s.creditCardReminders.filter((r) => r.accountId !== id),
          })),

        saveCardReminder: (r) =>
          set((s) => ({ creditCardReminders: [...s.creditCardReminders.filter((x) => x.accountId !== r.accountId), r] })),
        markCardPaid: (accountId) =>
          set((s) => ({
            creditCardReminders: s.creditCardReminders.map((r) => (r.accountId === accountId ? { ...r, paidDateEpochDay: toEpochDay(today()) } : r)),
          })),
        deleteCardReminder: (accountId) =>
          set((s) => ({ creditCardReminders: s.creditCardReminders.filter((r) => r.accountId !== accountId) })),

        addTrip: (t) => {
          const id = nid();
          set((s) => ({ trips: [{ ...t, id, tripName: t.tripName.trim(), categoryCapsJson: "{}" }, ...s.trips] }));
        },
        deleteTrip: (id) => set((s) => ({ trips: s.trips.filter((t) => t.id !== id) })),
        setTripCap: (id, category, cap) =>
          set((s) => ({
            trips: s.trips.map((t) => {
              if (t.id !== id) return t;
              let caps: Record<string, number> = {};
              try { caps = JSON.parse(t.categoryCapsJson || "{}"); } catch { caps = {}; }
              caps[category] = cap;
              return { ...t, categoryCapsJson: JSON.stringify(caps) };
            }),
          })),
        removeTripCap: (id, category) =>
          set((s) => ({
            trips: s.trips.map((t) => {
              if (t.id !== id) return t;
              let caps: Record<string, number> = {};
              try { caps = JSON.parse(t.categoryCapsJson || "{}"); } catch { caps = {}; }
              delete caps[category];
              return { ...t, categoryCapsJson: JSON.stringify(caps) };
            }),
          })),

        addSubscription: (sub) => {
          const id = nid();
          set((s) => ({
            subscriptions: [
              ...s.subscriptions,
              {
                ...sub,
                id,
                name: sub.name.trim(),
                dueDayOfMonth: Math.min(31, Math.max(1, sub.dueDayOfMonth)),
                dueMonth: Math.min(12, Math.max(1, sub.dueMonth)),
                dueDayOfWeek: Math.min(7, Math.max(1, sub.dueDayOfWeek)),
                lastPaidTimestamp: 0,
              },
            ],
          }));
        },
        deleteSubscription: (id) => set((s) => ({ subscriptions: s.subscriptions.filter((x) => x.id !== id) })),
        paySubscription: (id, accountId) => {
          const sub = get().subscriptions.find((x) => x.id === id);
          if (!sub) return { ok: false, message: "Could not record subscription payment: not found" };
          const acc = accountId != null ? get().bankAccounts.find((a) => a.id === accountId) : undefined;
          const now = Date.now();
          insertExpense({ title: `${sub.name} Bill`, amount: sub.amount, categoryName: sub.categoryName, type: "EXPENSE", bankAccountId: acc?.id ?? null, bankAccountName: acc?.bankName ?? "", dateTimestamp: now, notes: "Auto-logged from recurring subscription", tripId: null, loanId: null, debtId: null });
          set((s) => ({
            subscriptions: s.subscriptions.map((x) => (x.id === id ? { ...x, bankAccountId: acc?.id ?? null, bankAccountName: acc?.bankName ?? "", lastPaidTimestamp: now } : x)),
          }));
          return { ok: true, message: `Paid ₹${Math.trunc(sub.amount)} for ${sub.name} & recorded in ledger!` };
        },
        setBudget: (limit) => set({ monthlyBudgetLimit: limit }),
        setUpiId: (upi) => set({ userUpiId: upi }),

        addLoan: (l) => {
          const id = nid();
          const tenure = Math.max(1, Math.trunc(l.tenureMonths));
          const d = new Date();
          set((s) => ({
            loans: [
              {
                ...l,
                id,
                loanName: l.loanName.trim(),
                notes: l.notes.trim(),
                tenureMonths: tenure,
                emiAmount: l.emiAmount ?? standardEmi(l.principalAmount, l.annualInterestRate, tenure),
                paidEmisCount: Math.min(tenure, Math.max(0, Math.trunc(l.paidEmisCount))),
                dueDayOfMonth: Math.min(31, Math.max(1, Math.trunc(l.dueDayOfMonth))),
                startDate: `${String(d.getDate()).padStart(2, "0")} ${MON[d.getMonth()]} ${d.getFullYear()}`,
              },
              ...s.loans,
            ],
          }));
        },
        deleteLoan: (id) => set((s) => ({ loans: s.loans.filter((l) => l.id !== id) })),
        payLoanEmi: (id, preferred) => {
          const loan = get().loans.find((l) => l.id === id);
          if (!loan) return { ok: false, message: "Failed to record EMI payment" };
          if (loanStats(loan).isFullyPaid) return { ok: false, message: `Loan '${loan.loanName}' is already fully paid!` };
          const target = pickFundedAccount(balances(), preferred ?? loan.bankAccountId, loan.emiAmount);
          const n = loan.paidEmisCount + 1;
          bumpLoan(id, 1);
          const expenseId = insertExpense({
            title: `EMI: ${loan.loanName} (#${n})`, amount: loan.emiAmount, categoryName: "Bills & Utilities", type: "EXPENSE",
            bankAccountId: target?.account.id ?? null, bankAccountName: target?.account.bankName ?? "", dateTimestamp: Date.now(),
            notes: `Auto-logged from Active Loans Tracker. ${loan.tenureMonths - n} EMIs left.`, tripId: null, loanId: id, debtId: null,
          });
          return { ok: true, message: `Paid EMI #${n} (${loan.loanName})`, expenseId };
        },
        undoLoanEmi: (id, expenseId) => {
          bumpLoan(id, -1);
          const linked = get().expenses.filter((e) => e.loanId === id);
          const target = (expenseId != null ? linked.find((e) => e.id === expenseId) : undefined) ?? linked.sort((a, b) => b.dateTimestamp - a.dateTimestamp)[0];
          if (target) set((s) => ({ expenses: s.expenses.filter((e) => e.id !== target.id) }));
          const loan = get().loans.find((l) => l.id === id);
          return { ok: true, message: `Reverted EMI payment for ${loan?.loanName ?? "loan"}` };
        },

        addDebt: (d, adjust) => {
          const id = nid();
          const rec: DebtRecord = { ...d, id, personName: d.personName.trim(), dateTimestamp: Date.now(), isSettled: false, settledDateTimestamp: null };
          set((s) => ({ debts: [rec, ...s.debts] }));
          if (adjust && d.bankAccountId != null) {
            const acc = get().bankAccounts.find((a) => a.id === d.bankAccountId);
            insertExpense({
              title: d.type === "LENT" ? `Lent to ${rec.personName}` : `Borrowed from ${rec.personName}`,
              amount: d.amount, categoryName: "Bills & Utilities", type: d.type === "LENT" ? "EXPENSE" : "INCOME",
              bankAccountId: d.bankAccountId, bankAccountName: acc?.bankName ?? d.bankAccountName, dateTimestamp: Date.now(),
              notes: "Recorded in Personal Lend & Borrow Tracker", tripId: null, loanId: null, debtId: id,
            });
          }
        },
        settleDebt: (id, accountId, adjust) => {
          const debt = get().debts.find((d) => d.id === id);
          if (!debt) return { ok: false, message: "Debt not found" };
          set((s) => ({ debts: s.debts.map((d) => (d.id === id ? { ...d, isSettled: true, settledDateTimestamp: Date.now() } : d)) }));
          if (!adjust) return { ok: true, message: `Marked debt with ${debt.personName} as settled!` };
          const bal = balances();
          if (!bal.length) return { ok: true, message: "Debt marked settled (No bank accounts available)" };
          if (debt.type === "LENT") {
            const t = bal.find((a) => a.account.id === accountId) ?? bal[0];
            if (!t) return { ok: false, message: "No bank accounts available" };
            insertExpense({ title: `Settlement: ${debt.personName} repaid`, amount: debt.amount, categoryName: "Bills & Utilities", type: "INCOME", bankAccountId: t.account.id, bankAccountName: t.account.bankName, dateTimestamp: Date.now(), notes: "Settled debt from Udhaar ledger", tripId: null, loanId: null, debtId: id });
            return { ok: true, message: `Settled! Received into ${t.account.bankName}` };
          }
          let t = bal.find((a) => a.account.id === accountId) ?? bal[0];
          if (!t) return { ok: false, message: "No bank accounts available" };
          if (t.currentBalance < debt.amount) t = bal.find((a) => a.currentBalance >= debt.amount) ?? t;
          insertExpense({ title: `Settlement: Repaid ${debt.personName}`, amount: debt.amount, categoryName: "Bills & Utilities", type: "EXPENSE", bankAccountId: t.account.id, bankAccountName: t.account.bankName, dateTimestamp: Date.now(), notes: "Settled debt from Udhaar ledger", tripId: null, loanId: null, debtId: id });
          return { ok: true, message: `Settled! Repaid from ${t.account.bankName}` };
        },
        deleteDebt: (id) => set((s) => ({ debts: s.debts.filter((d) => d.id !== id) })),

        restoreBackup: (p, replace) => {
          const s = get();
          const data: FinanceData = {
            categories: s.categories, bankAccounts: s.bankAccounts, trips: s.trips, expenses: s.expenses, loans: s.loans,
            debts: s.debts, subscriptions: s.subscriptions, creditCardReminders: s.creditCardReminders,
            monthlyBudgetLimit: s.monthlyBudgetLimit, userUpiId: s.userUpiId, nextId: s.nextId,
          };
          set(restorePayload(data, p, replace));
        },
        resetAll: () => set(initialFinanceData()),
      };
    },
    {
      name: "omnicalc-finance",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        categories: s.categories, bankAccounts: s.bankAccounts, trips: s.trips, expenses: s.expenses, loans: s.loans,
        debts: s.debts, subscriptions: s.subscriptions, creditCardReminders: s.creditCardReminders,
        monthlyBudgetLimit: s.monthlyBudgetLimit, userUpiId: s.userUpiId, nextId: s.nextId,
      }),
    },
  ),
);

export function getFinanceData(): FinanceData {
  const s = useFinance.getState();
  return {
    categories: s.categories, bankAccounts: s.bankAccounts, trips: s.trips, expenses: s.expenses, loans: s.loans,
    debts: s.debts, subscriptions: s.subscriptions, creditCardReminders: s.creditCardReminders,
    monthlyBudgetLimit: s.monthlyBudgetLimit, userUpiId: s.userUpiId, nextId: s.nextId,
  };
}
