import Link from "next/link";
import { SearchXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NoResultsStateProps {
  query: string;
  clearFiltersHref: string;
}

export function NoResultsState({ query, clearFiltersHref }: NoResultsStateProps) {
  return (
    <section className="flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-10 text-center md:flex-1 md:justify-center md:py-16">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SearchXIcon aria-hidden="true" className="size-6" />
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <h2 className="text-lg font-semibold">No results</h2>
        <p className="text-sm text-muted-foreground">Nothing matches &ldquo;{query}&rdquo;. Try a different search.</p>
      </div>
      <Button asChild variant="outline">
        <Link href={clearFiltersHref}>Clear filters</Link>
      </Button>
    </section>
  );
}
