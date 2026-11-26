import Link from "next/link";
import { SearchXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

interface NoResultsStateProps {
  query: string;
  clearFiltersHref: string;
}

export function NoResultsState({ query, clearFiltersHref }: NoResultsStateProps) {
  return (
    <Empty className="border border-dashed md:flex-1">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchXIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>No results</EmptyTitle>
        <EmptyDescription>Nothing matches &ldquo;{query}&rdquo;. Try a different search.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline">
          <Link href={clearFiltersHref}>Clear filters</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
