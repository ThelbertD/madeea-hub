import { create } from "zustand";

// Shared UI state — the mobile sidebar drawer (so the guided tour can open it).
interface UIState {
  navOpen: boolean;
  setNavOpen: (v: boolean) => void;
}

export const useUI = create<UIState>((set) => ({
  navOpen: false,
  setNavOpen: (v) => set({ navOpen: v }),
}));
