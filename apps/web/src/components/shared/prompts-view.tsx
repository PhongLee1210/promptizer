import { FileTextIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { NoResultsState } from "@/components/no-results-state";
import { PageHeader } from "@/components/page-header";

interface PromptsViewProps {
  query: string;
}

export function PromptsView({ query }: PromptsViewProps) {
  return (
    <>
      <PageHeader title="All prompts" count={0} />
      {query ? (
        <NoResultsState query={query} clearFiltersHref="/prompts" />
      ) : (
        <EmptyState
          icon={FileTextIcon}
          title="No prompts yet"
          description="Save your first prompt to find, reuse and organise it here."
          action={{ label: "Create a prompt", href: "/prompts/new" }}
        />
      )}
    </>
  );
}
