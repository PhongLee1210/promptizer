import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PromptSummary } from "@/lib/prompts/prompts";

const updatedAtFormatter = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

export function PromptTable({ prompts }: { prompts: PromptSummary[] }) {
  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead className="text-right">Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {prompts.map((prompt) => (
            <TableRow key={prompt.id}>
              <TableCell className="max-w-80 truncate font-medium" title={prompt.title}>
                {prompt.title}
              </TableCell>
              <TableCell>{prompt.source}</TableCell>
              <TableCell>{prompt.category}</TableCell>
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
                <time dateTime={prompt.updatedAt.toISOString()}>{updatedAtFormatter.format(prompt.updatedAt)}</time>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
