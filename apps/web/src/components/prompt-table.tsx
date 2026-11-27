import Link from "next/link";
import type { Prompt } from "@promptizer/shared";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SOURCE_LABEL_BY_MODEL, formatPromptDate } from "@/lib/prompts/prompts";

export function PromptTable({ prompts }: { prompts: Prompt[] }) {
  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead className="text-right">Created</TableHead>
            <TableHead className="text-right">Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {prompts.map((prompt) => (
            <TableRow key={prompt.id}>
              <TableCell className="max-w-80 truncate font-medium" title={prompt.title}>
                <Link href={`/prompts/${prompt.id}`} className="hover:underline">
                  {prompt.title}
                </Link>
              </TableCell>
              <TableCell>{prompt.model ? SOURCE_LABEL_BY_MODEL[prompt.model] : "—"}</TableCell>
              <TableCell>{prompt.category?.name ?? "—"}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {prompt.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                <time dateTime={prompt.createdAt}>{formatPromptDate(prompt.createdAt)}</time>
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                <time dateTime={prompt.updatedAt}>{formatPromptDate(prompt.updatedAt)}</time>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
