import { create } from "zustand";
import type { Sop } from "@/types/db";

// Holds the currently "pinned" SOP run so its checklist can float across the app.
interface SopWidgetState {
  sop: Sop | null;
  runId: string | null;
  checked: string[];
  clientName: string | null;
  pin: (sop: Sop, runId: string | null, checked: string[], clientName: string | null) => void;
  setChecked: (checked: string[]) => void;
  unpin: () => void;
}

export const useSopWidget = create<SopWidgetState>((set) => ({
  sop: null,
  runId: null,
  checked: [],
  clientName: null,
  pin: (sop, runId, checked, clientName) => set({ sop, runId, checked, clientName }),
  setChecked: (checked) => set({ checked }),
  unpin: () => set({ sop: null, runId: null, checked: [], clientName: null }),
}));
