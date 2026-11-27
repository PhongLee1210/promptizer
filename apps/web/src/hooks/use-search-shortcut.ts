import { useEffect } from "react";
import type { RefObject } from "react";

export const SEARCH_SHORTCUT_KEY = "/";

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  );
}

export function useSearchShortcut(inputRef: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    function focusOnShortcut(event: KeyboardEvent) {
      if (event.key !== SEARCH_SHORTCUT_KEY || event.metaKey || event.ctrlKey || isTypingTarget(event.target)) return;
      event.preventDefault();
      inputRef.current?.focus();
    }
    document.addEventListener("keydown", focusOnShortcut);
    return () => document.removeEventListener("keydown", focusOnShortcut);
  }, [inputRef]);
}
