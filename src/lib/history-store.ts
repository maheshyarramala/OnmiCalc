// Saved calculations + favorites (calculation_history table), on-device.
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { toast } from "sonner";
import type { CalculationRecord } from "@/lib/finance/types";

interface HistoryState {
  records: CalculationRecord[];
  nextId: number;
  add(r: Omit<CalculationRecord, "id" | "timestamp" | "isFavorite">): void;
  toggleFavorite(id: number): void;
  remove(id: number): void;
  clearAll(): void;
}

export const useHistory = create<HistoryState>()(
  persist(
    (set) => ({
      records: [],
      nextId: 1,
      add: (r) =>
        set((s) => ({
          records: [{ ...r, id: s.nextId, timestamp: Date.now(), isFavorite: false }, ...s.records],
          nextId: s.nextId + 1,
        })),
      toggleFavorite: (id) =>
        set((s) => ({ records: s.records.map((r) => (r.id === id ? { ...r, isFavorite: !r.isFavorite } : r)) })),
      remove: (id) => set((s) => ({ records: s.records.filter((r) => r.id !== id) })),
      clearAll: () => set({ records: [] }),
    }),
    { name: "omnicalc-history", storage: createJSONStorage(() => localStorage), skipHydration: true },
  ),
);

export function saveToHistory(r: Omit<CalculationRecord, "id" | "timestamp" | "isFavorite">, message: string) {
  useHistory.getState().add(r);
  toast.success(message);
}

export const shareText = (r: Pick<CalculationRecord, "title" | "detailsText">) =>
  `${r.title}\n\n${r.detailsText}\n\nCalculated using OmniCalc`;
