import Link from "next/link";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PromptsListParams } from "@/lib/prompts/prompts";
import { promptsListHref } from "@/lib/prompts/prompts";

interface PromptActiveFiltersProps {
  params: PromptsListParams;
  categoryName?: string;
}

export function PromptActiveFilters({ params, categoryName }: PromptActiveFiltersProps) {
  const chips = [
    params.query && { label: `Search: ${params.query}`, href: promptsListHref({ ...params, query: "", page: 1 }) },
    params.category && {
      label: `Category: ${categoryName ?? "Unknown category"}`,
      href: promptsListHref({ ...params, category: "", page: 1 }),
    },
    params.tag && { label: `Tag: ${params.tag}`, href: promptsListHref({ ...params, tag: "", page: 1 }) },
  ].filter((chip): chip is { label: string; href: string } => Boolean(chip));
  if (chips.length === 0) {
    return null;
  }
  return (
    <div aria-label="Active filters" role="group" className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <Button key={chip.label} asChild variant="secondary" size="sm">
          <Link href={chip.href} aria-label={`Remove ${chip.label}`}>
            {chip.label}
            <XIcon aria-hidden="true" />
          </Link>
        </Button>
      ))}
      <Button asChild variant="ghost" size="sm">
        <Link href={promptsListHref({ view: params.view })}>Clear all</Link>
      </Button>
    </div>
  );
}
