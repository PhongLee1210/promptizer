"use client";

import { usePathname } from "next/navigation";
import { useRef } from "react";
import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { SEARCH_SHORTCUT_KEY, useSearchShortcut } from "@/hooks/use-search-shortcut";
import { isPromptListPath } from "@/lib/prompts/prompts";

function GlobalSearchForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  useSearchShortcut(inputRef);

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
        aria-keyshortcuts={SEARCH_SHORTCUT_KEY}
        placeholder="Search prompts"
        className="h-9 pr-9 pl-9"
      />
      <kbd
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border px-1.5 font-mono text-xs text-muted-foreground md:block"
      >
        {SEARCH_SHORTCUT_KEY}
      </kbd>
    </form>
  );
}

export function GlobalSearch() {
  if (isPromptListPath(usePathname())) {
    return null;
  }
  return (
    <>
      <Separator
        orientation="vertical"
        className="mx-2 data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center"
      />
      <GlobalSearchForm />
    </>
  );
}
