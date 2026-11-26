import Link from "next/link";
import { LayoutGridIcon, TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PromptsListParams, PromptsDisplayMode } from "@/lib/prompts/prompts";
import { promptsListHref } from "@/lib/prompts/prompts";

const VIEW_OPTIONS = [
  { view: "cards", label: "Cards", icon: LayoutGridIcon },
  { view: "table", label: "Table", icon: TableIcon },
] as const satisfies readonly { view: PromptsDisplayMode; label: string; icon: unknown }[];

export function PromptsViewToggle({ params }: { params: PromptsListParams }) {
  return (
    <nav aria-label="Prompt view" className="hidden items-center gap-1 md:flex">
      {VIEW_OPTIONS.map(({ view, label, icon: Icon }) => (
        <Button key={view} asChild variant={params.view === view ? "secondary" : "ghost"} size="sm">
          <Link href={promptsListHref({ ...params, view })} aria-current={params.view === view ? "page" : undefined}>
            <Icon aria-hidden="true" />
            {label}
          </Link>
        </Button>
      ))}
    </nav>
  );
}
