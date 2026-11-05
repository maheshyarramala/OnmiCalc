// Cross-screen UI intents (e.g. Home "Log Expense" opens the Finance add-expense dialog).
import { create } from "zustand";

export type FinanceIntent = "expense" | "income" | "trip" | "subscription" | null;

interface UiState {
  financeIntent: FinanceIntent;
  sheet: "hub" | "history" | "favorites" | "theme" | null;
  info: "ABOUT" | "TERMS" | "PRIVACY" | "CONTACT" | "DONATE" | null;
  setFinanceIntent(i: FinanceIntent): void;
  openSheet(s: UiState["sheet"]): void;
  openInfo(i: UiState["info"]): void;
}

export const useUi = create<UiState>()((set) => ({
  financeIntent: null,
  sheet: null,
  info: null,
  setFinanceIntent: (financeIntent) => set({ financeIntent }),
  openSheet: (sheet) => set({ sheet }),
  openInfo: (info) => set({ info }),
}));
