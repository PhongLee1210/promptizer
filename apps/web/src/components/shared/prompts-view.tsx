import { FileTextIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { NoResultsState } from "@/components/no-results-state";
import { PageHeader } from "@/components/page-header";
import { PromptCard } from "@/components/prompt-card";
import { PromptGrid } from "@/components/prompt-grid";
import { PromptTable } from "@/components/prompt-table";
import { PromptTagsFilter } from "@/components/prompt-tags-filter";
import { PromptsViewToggle } from "@/components/prompts-view-toggle";
import type { PromptsListParams } from "@/lib/prompts/prompts";
import { countTags, filterPrompts, promptsListHref } from "@/lib/prompts/prompts";
import { listPromptsForSession } from "@/lib/server/prompts";

export async function PromptsView({ params }: { params: PromptsListParams }) {
  const allPrompts = await listPromptsForSession();
  const prompts = filterPrompts(allPrompts, params);
  const tagOptions = countTags(allPrompts).map(({ tag, count }) => ({
    tag,
    count,
    active: tag === params.tag,
    href: promptsListHref({ ...params, tag: tag === params.tag ? "" : tag }),
  }));
  const isFiltered = Boolean(params.query || params.tag);

  return (
    <>
      <PageHeader
        title="All prompts"
        count={prompts.length}
        actions={
          <>
            <PromptsViewToggle params={params} />
            <PromptTagsFilter
              options={tagOptions}
              activeTag={params.tag}
              clearHref={promptsListHref({ ...params, tag: "" })}
            />
          </>
        }
      />
      {prompts.length === 0 ? (
        isFiltered ? (
          <NoResultsState query={params.query || params.tag} clearFiltersHref="/prompts" />
        ) : (
          <EmptyState
            icon={FileTextIcon}
            title="No prompts yet"
            description="Save your first prompt to find, reuse and organise it here."
            action={{ label: "Create a prompt", href: "/prompts/new" }}
          />
        )
      ) : params.view === "table" ? (
        <PromptTable prompts={prompts} />
      ) : (
        <PromptGrid>
          {prompts.map((prompt) => (
            <PromptCard key={prompt.id} prompt={prompt} />
          ))}
        </PromptGrid>
      )}
    </>
  );
}
