import Link from "next/link";
import { PencilIcon, Trash2Icon } from "lucide-react";
import type { ReactNode } from "react";
import type { Prompt } from "@promptizer/shared";
import { MarkdownPreview } from "@/components/markdown-preview";
import { PageHeader } from "@/components/page-header";
import { ALL_PROMPTS_BACK_LINK, PROMPT_PAGE_LAYOUT_CLASS } from "@/components/prompt-page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SOURCE_LABEL_BY_MODEL, formatPromptDate } from "@/lib/prompts/prompts";

function DetailRow({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{term}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function PromptDetails({ prompt }: { prompt: Prompt }) {
  return (
    <dl className="flex flex-col gap-4 rounded-xl border p-4">
      <DetailRow term="Category">{prompt.category?.name ?? "None"}</DetailRow>
      {prompt.model && <DetailRow term="Source">{SOURCE_LABEL_BY_MODEL[prompt.model]}</DetailRow>}
      {prompt.tags.length > 0 && (
        <DetailRow term="Tags">
          <span className="flex flex-wrap gap-1">
            {prompt.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </span>
        </DetailRow>
      )}
      <DetailRow term="Created">
        <time dateTime={prompt.createdAt}>{formatPromptDate(prompt.createdAt)}</time>
      </DetailRow>
      <DetailRow term="Updated">
        <time dateTime={prompt.updatedAt}>{formatPromptDate(prompt.updatedAt)}</time>
      </DetailRow>
    </dl>
  );
}

export function PromptDetailView({ prompt }: { prompt: Prompt }) {
  return (
    <>
      <PageHeader
        title={prompt.title}
        back={ALL_PROMPTS_BACK_LINK}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/prompts/${prompt.id}/edit`}>
                <PencilIcon aria-hidden="true" />
                Edit
              </Link>
            </Button>
            <Button asChild variant="outline" className="text-destructive">
              <Link href={`/prompts/${prompt.id}/delete`}>
                <Trash2Icon aria-hidden="true" />
                Delete
              </Link>
            </Button>
          </>
        }
      />
      <div className={PROMPT_PAGE_LAYOUT_CLASS}>
        <MarkdownPreview source={prompt.text} className="min-w-0 rounded-xl border p-6" />
        <PromptDetails prompt={prompt} />
      </div>
    </>
  );
}
