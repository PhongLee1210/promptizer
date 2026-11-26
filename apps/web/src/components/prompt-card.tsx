import Link from "next/link";
import { FolderIcon, TagIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PromptSourceIcon } from "@/components/prompt-source-icon";
import type { PromptSummary } from "@/lib/prompts/prompts";

interface PromptCardProps {
  prompt: PromptSummary;
}

export function PromptCard({ prompt }: PromptCardProps) {
  return (
    <Link
      href={`/prompts/${prompt.id}`}
      className="group bg-card border-border focus-visible:ring-ring/50 flex h-96 flex-col overflow-hidden rounded-xl border transition-shadow outline-none hover:shadow-md focus-visible:ring-[3px]"
    >
      <header className="bg-primary text-primary-foreground shrink-0 p-3">
        <h3 className="truncate text-lg font-medium" title={prompt.title}>
          {prompt.title}
        </h3>
      </header>
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-hidden px-3 py-4">
          <p className="line-clamp-10 text-sm leading-relaxed break-words whitespace-pre-line">{prompt.body}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1 p-3">
          {prompt.source && (
            <Badge variant="secondary">
              <PromptSourceIcon source={prompt.source} />
              {prompt.source}
            </Badge>
          )}
          {prompt.category && (
            <Badge variant="secondary">
              <FolderIcon aria-hidden="true" />
              {prompt.category}
            </Badge>
          )}
          {prompt.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              <TagIcon aria-hidden="true" />
              {tag}
            </Badge>
          ))}
        </div>
      </section>
    </Link>
  );
}
