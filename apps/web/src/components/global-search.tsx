"use client";

import { useEffect, useRef } from "react";
import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";

const FOCUS_SHORTCUT_KEY = "/";

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  );
}

export function GlobalSearch() {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function focusOnShortcut(event: KeyboardEvent) {
      if (event.key !== FOCUS_SHORTCUT_KEY || event.metaKey || event.ctrlKey || isTypingTarget(event.target)) return;
      event.preventDefault();
      inputRef.current?.focus();
    }
    document.addEventListener("keydown", focusOnShortcut);
    return () => document.removeEventListener("keydown", focusOnShortcut);
  }, []);

  return (
    <form role="search" action="/prompts" method="GET" className="relative w-full max-w-md">
      <SearchIcon
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        ref={inputRef}
        type="search"
        name="q"
        aria-label="Search prompts"
        aria-keyshortcuts={FOCUS_SHORTCUT_KEY}
        placeholder="Search prompts"
        className="h-9 pr-9 pl-9"
      />
      <kbd
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border px-1.5 font-mono text-xs text-muted-foreground md:block"
      >
        {FOCUS_SHORTCUT_KEY}
      </kbd>
    </form>
  );
}
