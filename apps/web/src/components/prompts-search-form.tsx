"use client";

import { useRef } from "react";
import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SEARCH_SHORTCUT_KEY, useSearchShortcut } from "@/hooks/use-search-shortcut";
import type { PromptsListParams } from "@/lib/prompts/prompts";
import { DEFAULT_PROMPTS_VIEW } from "@/lib/prompts/prompts";

export function PromptsSearchForm({ params }: { params: PromptsListParams }) {
  const inputRef = useRef<HTMLInputElement>(null);
  useSearchShortcut(inputRef);

  return (
    <form role="search" action="/prompts" className="relative w-full sm:max-w-sm sm:flex-1">
      <SearchIcon
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        ref={inputRef}
        type="search"
        name="q"
        defaultValue={params.query}
        aria-label="Search your prompts"
        aria-keyshortcuts={SEARCH_SHORTCUT_KEY}
        placeholder="Search title and text"
        className="pl-8"
        data-testid="list-search"
      />
      {params.category && <input type="hidden" name="category" value={params.category} />}
      {params.tag && <input type="hidden" name="tag" value={params.tag} />}
      {params.view !== DEFAULT_PROMPTS_VIEW && <input type="hidden" name="view" value={params.view} />}
    </form>
  );
}
