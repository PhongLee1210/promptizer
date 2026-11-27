import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PromptsListParams } from "@/lib/prompts/prompts";
import { pageCount, promptsListHref } from "@/lib/prompts/prompts";

interface PromptsPaginationProps {
  params: PromptsListParams;
  total: number;
  pageSize: number;
}

export function PromptsPagination({ params, total, pageSize }: PromptsPaginationProps) {
  const lastPage = pageCount(total, pageSize);
  const firstShown = (params.page - 1) * pageSize + 1;
  const lastShown = Math.min(params.page * pageSize, total);
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        Showing {firstShown}–{lastShown} of {total}
      </p>
      {lastPage > 1 && (
        <div className="flex items-center gap-2">
          {params.page > 1 ? (
            <Button asChild variant="outline">
              <Link href={promptsListHref({ ...params, page: params.page - 1 })} rel="prev">
                <ChevronLeftIcon aria-hidden="true" />
                Previous
              </Link>
            </Button>
          ) : null}
          <span className="text-sm" aria-current="page">
            Page {params.page} of {lastPage}
          </span>
          {params.page < lastPage ? (
            <Button asChild variant="outline">
              <Link href={promptsListHref({ ...params, page: params.page + 1 })} rel="next">
                Next
                <ChevronRightIcon aria-hidden="true" />
              </Link>
            </Button>
          ) : null}
        </div>
      )}
    </nav>
  );
}
