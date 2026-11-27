import Link from "next/link";
import { FolderIcon, TagIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { Prompt } from "@promptizer/shared";
import { PromptSourceIcon } from "@/components/prompt-source-icon";
import { Badge } from "@/components/ui/badge";
import { MARKDOWN_PROSE_CLASS, renderMarkdown } from "@/lib/prompts/markdown-render";
import { SOURCE_LABEL_BY_MODEL, formatPromptDate } from "@/lib/prompts/prompts";

const CARD_EXCERPT_MAX_CHARACTERS = 400;

function renderExcerpt(text: string): ReactNode {
  try {
    return renderMarkdown(text, {
      linksAsText: true,
      headingsAsText: true,
      maxCharacters: CARD_EXCERPT_MAX_CHARACTERS,
    });
  } catch {
    return <p className="whitespace-pre-line">{text.slice(0, CARD_EXCERPT_MAX_CHARACTERS)}</p>;
  }
}

export function PromptCard({ prompt }: { prompt: Prompt }) {
  const source = prompt.model ? SOURCE_LABEL_BY_MODEL[prompt.model] : null;
  return (
    <Link
      href={`/prompts/${prompt.id}`}
      data-testid="prompt-card"
      className="flex flex-col gap-3 rounded-xl border bg-card p-4 transition-[translate,box-shadow,border-color] outline-none hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <h3 className="truncate text-base font-semibold" title={prompt.title}>
        {prompt.title}
      </h3>
      <div
        className={`max-h-32 overflow-hidden text-muted-foreground [mask-image:linear-gradient(to_bottom,black_65%,transparent)] ${MARKDOWN_PROSE_CLASS}`}
      >
        {renderExcerpt(prompt.text)}
      </div>
      <footer className="mt-auto flex flex-wrap items-center gap-1 pt-1">
        {source && (
          <Badge variant="secondary">
            <PromptSourceIcon source={source} />
            {source}
          </Badge>
        )}
        {prompt.category && (
          <Badge variant="secondary">
            <FolderIcon aria-hidden="true" />
            {prompt.category.name}
          </Badge>
        )}
        {prompt.tags.map((tag) => (
          <Badge key={tag} variant="secondary">
            <TagIcon aria-hidden="true" />
            {tag}
          </Badge>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          Updated{" "}
          <time dateTime={prompt.updatedAt} title={`Created ${formatPromptDate(prompt.createdAt)}`}>
            {formatPromptDate(prompt.updatedAt)}
          </time>
        </span>
      </footer>
    </Link>
  );
}
