// Entity shapes mirror the Android Room entities (data/local/entity/*) so
// Backup / Restore JSON files from the Android app import 1:1.

export type TxType = "EXPENSE" | "INCOME" | "TRANSFER_IN" | "TRANSFER_OUT";

export interface ExpenseCategory {
  id: number;
  name: string;
  colorHex: string;
  iconName: string;
  isCustom: boolean;
}

export interface ExpenseRecord {
  id: number;
  title: string;
  amount: number;
  categoryName: string;
  type: TxType | string;
  bankAccountId: number | null;
  bankAccountName: string;
  dateTimestamp: number;
  notes: string;
  tripId: number | null;
  loanId: number | null;
  debtId: number | null;
}

export interface BankAccount {
  id: number;
  bankName: string;
  accountType: string;
  accountNumber: string;
  ifscOrRouting: string;
  holderName: string;
  openingBalance: number;
  balance: number;
  notes: string;
}

export interface CreditCardBillReminder {
  accountId: number;
  amount: number;
  dueDateEpochDay: number;
  paidDateEpochDay: number; // -1 when unpaid
  notificationsEnabled: boolean;
}

export interface TripRecord {
  id: number;
  tripName: string;
  destination: string;
  budget: number;
  startDate: string;
  endDate: string;
  notes: string;
  categoryCapsJson: string;
}

export interface SubscriptionRecord {
  id: number;
  name: string;
  amount: number;
  billingCycle: "MONTHLY" | "YEARLY" | "WEEKLY" | string;
  dueDayOfMonth: number;
  dueMonth: number;
  dueDayOfWeek: number;
  categoryName: string;
  bankAccountId: number | null;
  bankAccountName: string;
  lastPaidTimestamp: number;
  notes: string;
}

export type LoanCategory = "HOME" | "PERSONAL" | "CAR" | "MOBILE" | "EDUCATION" | "OTHER";

export interface LoanRecord {
  id: number;
  loanName: string;
  loanCategory: LoanCategory | string;
  principalAmount: number;
  annualInterestRate: number;
  tenureMonths: number;
  emiAmount: number;
  startDate: string;
  paidEmisCount: number;
  notes: string;
  bankAccountId: number | null;
  bankAccountName: string;
  dueDayOfMonth: number;
}

export interface DebtRecord {
  id: number;
  personName: string;
  amount: number;
  type: "LENT" | "BORROWED" | string;
  dateTimestamp: number;
  dueDateTimestamp: number | null;
  isSettled: boolean;
  settledDateTimestamp: number | null;
  notes: string;
  bankAccountId: number | null;
  bankAccountName: string;
}

export interface CalculationRecord {
  id: number;
  category: string;
  title: string;
  summary: string;
  detailsText: string;
  timestamp: number;
  isFavorite: boolean;
}

export interface FinanceData {
  categories: ExpenseCategory[];
  bankAccounts: BankAccount[];
  trips: TripRecord[];
  expenses: ExpenseRecord[];
  loans: LoanRecord[];
  debts: DebtRecord[];
  subscriptions: SubscriptionRecord[];
  creditCardReminders: CreditCardBillReminder[];
  monthlyBudgetLimit: number;
  userUpiId: string | null;
  nextId: number;
}

export interface AccountWithBalance {
  account: BankAccount;
  openingBalance: number;
  totalIncome: number;
  totalExpense: number;
  currentBalance: number;
}
