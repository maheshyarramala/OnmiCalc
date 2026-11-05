import { beforeEach, describe, expect, it } from "vitest";
import { calculateEmi, calculateLoanPrepayment } from "@/lib/calc/emi";
import { money, moneyWhole, setPrivacyMode } from "@/lib/format";
import { evaluate } from "@/lib/calc/scientific";
import { nextDueDate, isPaidInCurrentCycle } from "@/lib/calc/dates";
import { calculateGst } from "@/lib/calc/utility";
import { calculateSip } from "@/lib/calc/investment";
import { calculateBreakdowns, settleTransfers, type Participant } from "@/lib/calc/splitbill";
import { parseSms } from "@/lib/finance/sms";
import { exportToJson, parseFromJson } from "@/lib/finance/backup";
import { accountsWithBalances } from "@/lib/finance/logic";
import { getFinanceData, useFinance } from "@/lib/finance/store";

beforeEach(() => {
  setPrivacyMode(false);
  useFinance.getState().resetAll();
});

describe("money formatting (Indian numbering)", () => {
  it("groups lakhs and crores", () => {
    expect(moneyWhole(1000000)).toBe("₹ 10,00,000");
    expect(money(569010.86)).toBe("₹ 5,69,010.86");
    expect(money(-5000)).toBe("-₹ 5,000");
  });
  it("hides amounts in privacy mode", () => {
    setPrivacyMode(true);
    expect(money(123)).toBe("••••••");
  });
});

describe("EMI", () => {
  it("₹10L at 8.5% for 10 years is ₹12,398.57/month", () => {
    const r = calculateEmi(1000000, 8.5, 120);
    expect(r.monthlyEmi).toBeCloseTo(12398.57, 2);
    expect(r.schedule).toHaveLength(120);
  });
  it("a prepayment shortens the tenure and saves interest", () => {
    const r = calculateEmi(1000000, 8.5, 120, [{ month: 12, amount: 200000 }]);
    expect(r.tenureMonthsSaved).toBeGreaterThan(0);
    expect(r.interestSaved).toBeGreaterThan(0);
  });
  it("prepaying the whole remaining principal forecloses the loan", () => {
    const r = calculateLoanPrepayment(100000, 10, 5000, 24, 150000);
    expect(r.isForeclosed).toBe(true);
    expect(r.prepaymentApplied).toBe(100000);
  });
});

describe("calculators", () => {
  it("GST 18% exclusive on ₹1000 totals ₹1180 with ₹90 CGST", () => {
    const r = calculateGst(1000, 18, true);
    expect(r.finalTotalAmount).toBe(1180);
    expect(r.cgstAmount).toBe(90);
  });
  it("scientific evaluator uses degrees by default", () => {
    const r = evaluate("sin(30)×2", false);
    expect(r.ok && r.formatted).toBe("1");
  });
  it("division by zero is an error", () => {
    expect(evaluate("5÷0", false).ok).toBe(false);
  });
  it("SIP of ₹10,000 for 10y invests ₹12L", () => {
    expect(calculateSip(10000, 12, 10).investedAmount).toBe(1200000);
  });
});

describe("subscriptions", () => {
  const base = { billingCycle: "MONTHLY", dueDayOfMonth: 10, dueMonth: 1, dueDayOfWeek: 1, lastPaidTimestamp: 0 };
  it("monthly bill due later this month stays this month", () => {
    expect(nextDueDate(base, { y: 2026, m: 11, d: 5 })).toEqual({ y: 2026, m: 11, d: 10 });
  });
  it("paying this month moves the due date to next month", () => {
    const paid = { ...base, lastPaidTimestamp: new Date(2026, 10, 3, 12).getTime() };
    expect(isPaidInCurrentCycle(paid, { y: 2026, m: 11, d: 5 })).toBe(true);
    expect(nextDueDate(paid, { y: 2026, m: 11, d: 5 })).toEqual({ y: 2026, m: 12, d: 10 });
  });
  it("due day 31 clamps to the month length", () => {
    expect(nextDueDate({ ...base, dueDayOfMonth: 31 }, { y: 2026, m: 2, d: 1 })).toEqual({ y: 2026, m: 2, d: 28 });
  });
});

describe("split bill", () => {
  it("one payer of ₹300 split three ways gets ₹200 back", () => {
    const p = (id: string, paid = 0): Participant => ({ id, name: id, avatarColorHex: "#000", upiId: "", paypalUsername: "", paidAmount: paid });
    const b = calculateBreakdowns([p("a", 300), p("b"), p("c")], [{ id: "i", title: "Pizza", price: 300, quantity: 1, claimedParticipantIds: [], paidByParticipantId: null }], 0, 0, 0);
    const t = settleTransfers(b, true);
    expect(t).toHaveLength(2);
    expect(t.every((x) => x.toParticipant.id === "a" && x.amount === 100)).toBe(true);
  });
});

describe("finance ledger", () => {
  it("balance = opening + income − expenses, transfers move money between accounts", () => {
    const s = useFinance.getState();
    const [bank, cash] = s.bankAccounts;
    if (!bank || !cash) throw new Error("default accounts missing");
    s.updateOpeningBalance(bank.id, 50000);
    s.addExpense({ title: "Lunch", amount: 1000, categoryName: "Food & Dining", type: "EXPENSE", bankAccountId: bank.id, bankAccountName: bank.bankName, notes: "" });
    const r = useFinance.getState().transfer(bank.id, cash.id, 2000, "");
    expect(r.ok).toBe(true);
    const bal = accountsWithBalances(useFinance.getState().bankAccounts, useFinance.getState().expenses);
    expect(bal.find((b) => b.account.id === bank.id)!.currentBalance).toBe(47000);
    expect(bal.find((b) => b.account.id === cash.id)!.currentBalance).toBe(2000);
  });
  it("paying an EMI logs an expense and deleting it reverts the paid count", () => {
    const s = useFinance.getState();
    s.addLoan({ loanName: "HDFC", loanCategory: "PERSONAL", principalAmount: 600000, annualInterestRate: 10.5, tenureMonths: 60, paidEmisCount: 0, notes: "", bankAccountId: null, bankAccountName: "", dueDayOfMonth: 5 });
    const loan = useFinance.getState().loans[0];
    if (!loan) throw new Error("loan not added");
    const r = useFinance.getState().payLoanEmi(loan.id, null);
    expect(r.ok && r.message).toBe("Paid EMI #1 (HDFC)");
    expect(useFinance.getState().loans[0]?.paidEmisCount).toBe(1);
    const exp = useFinance.getState().expenses.find((e) => e.loanId === loan.id)!;
    expect(exp.title).toBe("EMI: HDFC (#1)");
    useFinance.getState().deleteExpenses([exp.id]);
    expect(useFinance.getState().loans[0]?.paidEmisCount).toBe(0);
  });
});

describe("Android backup compatibility", () => {
  const android = JSON.stringify({
    version: 3, app: "OmniCalc", monthlyBudgetLimit: 40000,
    categories: [{ id: 1, name: "Food & Dining", colorHex: "#EF4444", iconName: "restaurant", isCustom: false }, { id: 20, name: "Pets", colorHex: "#06B6D4", iconName: "category", isCustom: true }],
    bankAccounts: [{ id: 7, bankName: "HDFC", accountType: "Savings", accountNumber: "1234", openingBalance: 50000, balance: 50000 }],
    expenses: [{ id: 99, title: "Groceries", amount: 1000, categoryName: "Food & Dining", type: "EXPENSE", bankAccountId: 7, bankAccountName: "HDFC", dateTimestamp: 1730000000000, notes: "", loanId: 3 }],
    loans: [{ id: 3, loanName: "Car", loanCategory: "CAR", principalAmount: 500000, annualInterestRate: 9, tenureMonths: 48, emiAmount: 12442.6, startDate: "01 Jan 2026", paidEmisCount: 4, dueDayOfMonth: 5 }],
  });
  it("parses the summary like the Android app", () => {
    const r = parseFromJson(android);
    expect(r.ok && r.summary).toBe("2 Categories, 1 Accounts, 1 Expenses, 1 Loans, Budget");
  });
  it("merging remaps ids so the expense stays linked to its account and loan", () => {
    const r = parseFromJson(android);
    if (!r.ok) throw new Error(r.message);
    useFinance.getState().restoreBackup(r.payload, false);
    const d = getFinanceData();
    const hdfc = d.bankAccounts.find((a) => a.bankName === "HDFC")!;
    const car = d.loans.find((l) => l.loanName === "Car")!;
    const exp = d.expenses.find((e) => e.title === "Groceries")!;
    expect(exp.bankAccountId).toBe(hdfc.id);
    expect(exp.loanId).toBe(car.id);
    expect(d.categories.filter((c) => c.name === "Food & Dining")).toHaveLength(1);
    expect(d.monthlyBudgetLimit).toBe(50000); // merge keeps the current budget
  });
  it("replace restores the budget and round-trips through export", () => {
    const r = parseFromJson(android);
    if (!r.ok) throw new Error(r.message);
    useFinance.getState().restoreBackup(r.payload, true);
    expect(getFinanceData().monthlyBudgetLimit).toBe(40000);
    const again = parseFromJson(exportToJson(getFinanceData()));
    expect(again.ok && again.payload.expenses[0]?.loanId).toBe(3);
  });
});

describe("bank SMS parser", () => {
  it("reads a UPI debit SMS", () => {
    const p = parseSms("Rs.450.00 debited from A/c XX1234 to swiggy@upi on 05-11-26", [
      { id: 1, bankName: "HDFC", accountType: "Savings", accountNumber: "001234", ifscOrRouting: "", holderName: "", openingBalance: 0, balance: 0, notes: "" },
    ]);
    expect(p?.amount).toBe(450);
    expect(p?.isIncome).toBe(false);
    expect(p?.suggestedCategory).toBe("Food & Dining");
    expect(p?.matchedAccountId).toBe(1);
  });
});
