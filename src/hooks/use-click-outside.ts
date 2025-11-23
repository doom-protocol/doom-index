import { useEffect, type RefObject } from "react";

/**
 * Hook to handle click outside detection for dropdowns/menus
 * Supports conditional enabling and different event targets
 */
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onClickOutside: () => void,
  enabled: boolean = true,
  eventTarget: "document" | "window" = "document",
  eventType: "mousedown" | "pointerdown" = "mousedown",
): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleEvent = (event: Event) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClickOutside();
      }
    };

    const target = eventTarget === "window" ? window : document;
    target.addEventListener(eventType, handleEvent);

    return () => {
      target.removeEventListener(eventType, handleEvent);
    };
  }, [ref, onClickOutside, enabled, eventTarget, eventType]);
}

/**
 * Hook to handle escape key detection for closing modals/menus
 */
export function useEscapeKey(
  onEscape: () => void,
  enabled: boolean = true,
  eventTarget: "document" | "window" = "window",
): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyDown = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key === "Escape") {
        onEscape();
      }
    };

    const target = eventTarget === "window" ? window : document;
    target.addEventListener("keydown", handleKeyDown);

    return () => {
      target.removeEventListener("keydown", handleKeyDown);
    };
  }, [onEscape, enabled, eventTarget]);
}
