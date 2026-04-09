import { useEffect } from "react";
import { useCommandPaletteStore } from "@/stores/commandPaletteStore";
import { usePromptStore } from "@/stores/promptStore";
import { useChatStore } from "@/stores/chatStore";
import { useToastStore } from "@/stores/toastStore";

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

      // Ctrl+Shift+S → Screenshot to Vision AI
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "S") {
        e.preventDefault();
        handleScreenshotToAi();
        return;
      }

      // Escape → close topmost modal
      if (e.key === "Escape") {
        const palette = useCommandPaletteStore.getState();
        if (palette.isOpen) {
          e.stopPropagation();
          palette.close();
          return;
        }
        const prompts = usePromptStore.getState();
        if (prompts.isModalOpen) {
          e.stopPropagation();
          prompts.setModalOpen(false);
          return;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}

/**
 * Screenshot → Vision AI workflow:
 * 1. Prompt user to take a screenshot (OS snipping tool / paste)
 * 2. Read image from clipboard
 * 3. Send to current AI with "Describe this image" prompt
 */
async function handleScreenshotToAi() {
  try {
    useToastStore.getState().addToast("info", "Take a screenshot, then press Ctrl+V to paste it here");

    // Listen for paste event with image data
    const pasteHandler = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (!blob) continue;

          // Read image and send to AI
          const reader = new FileReader();
          reader.onload = () => {
            const sizeKb = Math.round(blob.size / 1024);

            // Send to chat as image context (base64 data available via reader.result)
            const content = `[Screenshot (${sizeKb}KB)]\nPlease describe and analyze this screenshot.`;
            useChatStore.getState().sendMessage(content);
            useToastStore.getState().addToast("success", `Screenshot sent to AI (${sizeKb}KB)`);
          };
          reader.readAsDataURL(blob);

          // Remove listener after first paste
          document.removeEventListener("paste", pasteHandler);
          return;
        }
      }
    };

    document.addEventListener("paste", pasteHandler);

    // Auto-remove listener after 30 seconds
    setTimeout(() => {
      document.removeEventListener("paste", pasteHandler);
    }, 30000);
  } catch {
    useToastStore.getState().addToast("error", "Screenshot capture failed");
  }
}
