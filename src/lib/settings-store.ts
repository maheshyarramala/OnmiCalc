// Theme, accent, haptics and privacy preferences (ThemeManager.kt), on-device.
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { setPrivacyMode } from "@/lib/format";

export type ThemeMode = "SYSTEM" | "LIGHT" | "DARK" | "AMOLED";
export type Accent = "INDIGO" | "EMERALD" | "PURPLE" | "AMBER" | "ROSE" | "CYAN";
export type Haptic = "CRISP" | "SUBTLE" | "OFF";

export const THEME_MODES: { id: ThemeMode; title: string }[] = [
  { id: "SYSTEM", title: "System" },
  { id: "LIGHT", title: "Light" },
  { id: "DARK", title: "Dark" },
  { id: "AMOLED", title: "AMOLED" },
];
export const ACCENTS: { id: Accent; title: string; light: string; dark: string }[] = [
  { id: "INDIGO", title: "Deep Indigo", light: "#4F46E5", dark: "#818CF8" },
  { id: "EMERALD", title: "Emerald Wealth", light: "#059669", dark: "#34D399" },
  { id: "PURPLE", title: "Cyber Purple", light: "#7C3AED", dark: "#A78BFA" },
  { id: "AMBER", title: "Sunset Amber", light: "#D97706", dark: "#FBBF24" },
  { id: "ROSE", title: "Sunset Rose", light: "#E11D48", dark: "#FB7185" },
  { id: "CYAN", title: "Ocean Blue", light: "#0284C7", dark: "#38BDF8" },
];
export const HAPTICS: { id: Haptic; title: string }[] = [
  { id: "CRISP", title: "Crisp (Default)" },
  { id: "SUBTLE", title: "Subtle" },
  { id: "OFF", title: "Off" },
];

interface SettingsState {
  themeMode: ThemeMode;
  accent: Accent;
  haptic: Haptic;
  privacy: boolean;
  setThemeMode(m: ThemeMode): void;
  setAccent(a: Accent): void;
  setHaptic(h: Haptic): void;
  togglePrivacy(): void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      themeMode: "DARK",
      accent: "INDIGO",
      haptic: "CRISP",
      privacy: false,
      setThemeMode: (themeMode) => set({ themeMode }),
      setAccent: (accent) => set({ accent }),
      setHaptic: (haptic) => set({ haptic }),
      togglePrivacy: () =>
        set((s) => {
          setPrivacyMode(!s.privacy);
          return { privacy: !s.privacy };
        }),
    }),
    {
      name: "omnicalc-settings",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      onRehydrateStorage: () => (s) => {
        if (s) setPrivacyMode(s.privacy);
      },
    },
  ),
);

export function haptic(kind: "tap" | "long" = "tap") {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  const h = useSettings.getState().haptic;
  if (h === "OFF") return;
  try {
    navigator.vibrate(h === "CRISP" ? (kind === "long" ? 18 : 10) : 5);
  } catch {
    /* unsupported */
  }
}
