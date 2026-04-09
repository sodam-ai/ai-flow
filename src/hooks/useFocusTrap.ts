import { useEffect } from "react";

/**
 * Focusable element selectors — matches the ARIA APG "Keyboard Support"
 * specification for dialog focus management.
 */
const FOCUSABLE_SELECTORS = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * useFocusTrap
 *
 * Traps Tab / Shift+Tab focus within `containerRef` while `active`.
 * Implements WCAG 2.4.3 Focus Order + ARIA 1.2 §6.8 Modal Dialog pattern.
 *
 * Does NOT move initial focus — pair with a `requestAnimationFrame(() => el.focus())`
 * in the component's mount effect for that.
 *
 * @param containerRef  Ref to the dialog container element
 * @param active        Whether the trap is active (default: true)
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  active = true,
) {
  useEffect(() => {
    if (!active) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const container = containerRef.current;
      if (!container) return;

      // Collect visible, non-aria-hidden focusable elements
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS),
      ).filter(
        (el) =>
          !el.closest("[aria-hidden='true']") &&
          el.offsetParent !== null, // exclude display:none
      );

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        // Shift+Tab on first element → wrap to last
        if (active === first || !container.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab on last element → wrap to first
        if (active === last || !container.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handler, true); // capture phase
    return () => document.removeEventListener("keydown", handler, true);
  }, [active, containerRef]);
}
