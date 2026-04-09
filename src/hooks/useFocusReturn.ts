import { useEffect, useRef } from "react";

/**
 * Captures the focused element when `active` becomes true (or on mount),
 * and restores focus to it when `active` becomes false or the component unmounts.
 *
 * Satisfies WCAG 2.4.3 Focus Order — after a dialog closes, keyboard focus
 * must return to the element that triggered it, not escape to <body>.
 *
 * Usage:
 *   // Always-rendered modal (mounts/unmounts with dialog)
 *   useFocusReturn();
 *
 *   // Persistently-mounted modal toggled by a boolean
 *   useFocusReturn(isOpen);
 */
export function useFocusReturn(active = true) {
  const returnTargetRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    // Capture whichever element currently has focus (the trigger button)
    returnTargetRef.current = document.activeElement as HTMLElement | null;
    // Cleanup: restore focus when active → false or component unmounts
    return () => {
      returnTargetRef.current?.focus?.();
    };
  }, [active]);
}
