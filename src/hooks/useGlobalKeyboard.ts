import { useEffect } from "react";
import { useCommandPaletteStore } from "@/stores/commandPaletteStore";
import { usePromptStore } from "@/stores/promptStore";

/**
 * Global keyboard shortcuts for the main window.
 * Note: Alt+Space and Alt+Shift+A are registered as OS-level shortcuts
 * via Tauri's global-shortcut plugin (in lib.rs), not here.
 */
export function useGlobalKeyboard() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+K or Cmd+K → Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        useCommandPaletteStore.getState().toggle();
        return;
      }

      // Escape → close topmost modal
      if (e.key === "Escape") {
        const palette = useCommandPaletteStore.getState();
        if (palette.isOpen) {
          palette.close();
          return;
        }
        const prompts = usePromptStore.getState();
        if (prompts.isModalOpen) {
          prompts.setModalOpen(false);
          return;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
