import { FileTextIcon } from "lucide-react";
import type { CategorySummary, PromptListPage } from "@promptizer/shared";
import { EmptyState } from "@/components/empty-state";
import { NoResultsState } from "@/components/no-results-state";
import { PageHeader } from "@/components/page-header";
import { PromptActiveFilters } from "@/components/prompt-active-filters";
import { PromptCard } from "@/components/prompt-card";
import type { FilterMenuOption } from "@/components/prompt-filters";
import { PromptCategoryFilter, PromptTagsFilter } from "@/components/prompt-filters";
import { PromptGrid } from "@/components/prompt-grid";
import { PromptTable } from "@/components/prompt-table";
import { PromptsPagination } from "@/components/prompts-pagination";
import { PromptsSearchForm } from "@/components/prompts-search-form";
import { PromptsViewToggle } from "@/components/prompts-view-toggle";
import type { PromptsListParams } from "@/lib/prompts/prompts";
import { promptsListHref } from "@/lib/prompts/prompts";
import { loadPromptListForSession } from "@/lib/server/prompt-pages";

interface PromptsToolbarProps {
  params: PromptsListParams;
  categories: CategorySummary[];
  tagCounts: { tag: string; count: number }[];
}

function filterHref(params: PromptsListParams, changes: Partial<PromptsListParams>): string {
  return promptsListHref({ ...params, ...changes, page: 1 });
}

function activeCategoryName(params: PromptsListParams, categories: CategorySummary[]): string | undefined {
  if (!params.category) {
    return undefined;
  }
  return categories.find((category) => category.id === params.category)?.name ?? "Unknown category";
}

function PromptsToolbar({ params, categories, tagCounts }: PromptsToolbarProps) {
  const categoryOptions: FilterMenuOption[] = categories.map((category) => ({
    value: category.id,
    label: category.name,
    active: category.id === params.category,
    href: filterHref(params, { category: category.id === params.category ? "" : category.id }),
  }));
  const tagOptions: FilterMenuOption[] = tagCounts.map(({ tag, count }) => ({
    value: tag,
    label: tag,
    count,
    active: tag === params.tag,
    href: filterHref(params, { tag: tag === params.tag ? "" : tag }),
  }));
  const categoryName = activeCategoryName(params, categories);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <PromptsSearchForm params={params} />
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          {categoryOptions.length > 0 && (
            <PromptCategoryFilter
              options={categoryOptions}
              activeLabel={categoryName}
              clearHref={filterHref(params, { category: "" })}
            />
          )}
          {tagOptions.length > 0 && (
            <PromptTagsFilter
              options={tagOptions}
              activeLabel={params.tag || undefined}
              clearHref={filterHref(params, { tag: "" })}
            />
          )}
        </div>
      </div>
      <PromptActiveFilters params={params} categoryName={categoryName} />
    </div>
  );
}

function PromptsResults({ params, page }: { params: PromptsListParams; page: PromptListPage }) {
  if (page.items.length === 0) {
    return page.total === 0 ? (
      <NoResultsState
        title="No results"
        description="Nothing matches these filters. Try a different search or clear the filters."
        actionLabel="Clear filters"
        actionHref={promptsListHref({ view: params.view })}
      />
    ) : (
      <NoResultsState
        title="This page is empty"
        description={`There are only ${page.total} matching prompts.`}
        actionLabel="Go to first page"
        actionHref={filterHref(params, {})}
      />
    );
  }
  return (
    <>
      {params.view === "table" ? (
        <PromptTable prompts={page.items} />
      ) : (
        <PromptGrid>
          {page.items.map((prompt) => (
            <PromptCard key={prompt.id} prompt={prompt} />
          ))}
        </PromptGrid>
      )}
      <PromptsPagination params={params} total={page.total} pageSize={page.pageSize} />
    </>
  );
}

export async function PromptsView({ params }: { params: PromptsListParams }) {
  const { page, categories, tagCounts } = await loadPromptListForSession(params);
  const isFiltered = Boolean(params.query || params.tag || params.category);
  const libraryIsEmpty = page.total === 0 && !isFiltered;

  if (libraryIsEmpty) {
    return (
      <>
        <PageHeader title="All prompts" />
        <EmptyState
          icon={FileTextIcon}
          title="No prompts yet"
          description="Save your first prompt to find, reuse and organise it here."
          action={{ label: "Create your first prompt", href: "/prompts/new" }}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="All prompts" count={page.total} actions={<PromptsViewToggle params={params} />} />
      <PromptsToolbar params={params} categories={categories} tagCounts={tagCounts} />
      <PromptsResults params={params} page={page} />
    </>
  );
}
