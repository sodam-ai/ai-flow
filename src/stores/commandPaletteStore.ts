import { create } from "zustand";

export interface PaletteCommand {
  id: string;
  label: string;
  labelKo: string;
  keywords: string[];
  icon: string;
  category: "chat" | "persona" | "prompt" | "navigation" | "settings";
  action: () => void;
}

interface CommandPaletteState {
  isOpen: boolean;
  query: string;
  commands: PaletteCommand[];
  selectedIndex: number;

  open: () => void;
  close: () => void;
  toggle: () => void;
  setQuery: (q: string) => void;
  moveUp: () => void;
  moveDown: () => void;
  executeSelected: () => void;
  registerCommands: (cmds: PaletteCommand[]) => void;
  getFilteredCommands: () => PaletteCommand[];
}

export const useCommandPaletteStore = create<CommandPaletteState>((set, get) => ({
  isOpen: false,
  query: "",
  commands: [],
  selectedIndex: 0,

  open: () => set({ isOpen: true, query: "", selectedIndex: 0 }),
  close: () => set({ isOpen: false, query: "", selectedIndex: 0 }),
  toggle: () => {
    const { isOpen } = get();
    if (isOpen) {
      get().close();
    } else {
      get().open();
    }
  },

  setQuery: (q) => set({ query: q, selectedIndex: 0 }),

  moveUp: () => {
    const filtered = get().getFilteredCommands();
    set((s) => ({
      selectedIndex: s.selectedIndex <= 0 ? filtered.length - 1 : s.selectedIndex - 1,
    }));
  },

  moveDown: () => {
    const filtered = get().getFilteredCommands();
    set((s) => ({
      selectedIndex: s.selectedIndex >= filtered.length - 1 ? 0 : s.selectedIndex + 1,
    }));
  },

  executeSelected: () => {
    const filtered = get().getFilteredCommands();
    const cmd = filtered[get().selectedIndex];
    if (cmd) {
      cmd.action();
      get().close();
    }
  },

  registerCommands: (cmds) => set({ commands: cmds }),

  getFilteredCommands: () => {
    const { query, commands } = get();
    if (!query.trim()) return commands;

    const lower = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(lower) ||
        cmd.labelKo.includes(lower) ||
        cmd.keywords.some((kw) => kw.toLowerCase().includes(lower)),
    );
  },
}));
