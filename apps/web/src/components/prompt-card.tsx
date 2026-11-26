import Link from "next/link";
import { FolderIcon, SparklesIcon, TagIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { PromptSummary } from "@/lib/prompts/prompts";
import { promptsListHref } from "@/lib/prompts/prompts";

interface PromptCardProps {
  prompt: PromptSummary;
}

export function PromptCard({ prompt }: PromptCardProps) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="bg-primary px-4 py-4 text-primary-foreground">
        <CardTitle className="truncate text-lg font-medium" title={prompt.title}>
          {prompt.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="grow px-4 py-5">
        <p className="line-clamp-8 text-sm leading-relaxed break-words whitespace-pre-line">{prompt.body}</p>
      </CardContent>
      <CardFooter className="flex-wrap gap-2 px-4 pb-4">
        {prompt.source && (
          <Badge variant="secondary">
            <SparklesIcon aria-hidden="true" />
            {prompt.source}
          </Badge>
        )}
        {prompt.category && (
          <Badge variant="outline">
            <FolderIcon aria-hidden="true" />
            {prompt.category}
          </Badge>
        )}
        {prompt.tags.map((tag) => (
          <Badge key={tag} variant="outline" asChild>
            <Link href={promptsListHref({ tag })}>
              <TagIcon aria-hidden="true" />
              {tag}
            </Link>
          </Badge>
        ))}
      </CardFooter>
    </Card>
  );
}
