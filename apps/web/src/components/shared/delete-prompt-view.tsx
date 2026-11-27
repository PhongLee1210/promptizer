import Link from "next/link";
import type { Prompt } from "@promptizer/shared";
import { DeletePromptButton } from "@/components/delete-prompt-button";
import { PageHeader } from "@/components/page-header";
import { promptBackLink } from "@/components/prompt-page-layout";
import { Button } from "@/components/ui/button";

export function DeletePromptView({ prompt }: { prompt: Prompt }) {
  return (
    <>
      <PageHeader title="Delete prompt" back={promptBackLink(prompt.id)} />
      <section aria-labelledby="delete-prompt-question" className="flex max-w-xl flex-col gap-4 rounded-xl border p-6">
        <h2 id="delete-prompt-question" className="text-base font-semibold break-words">
          Delete &ldquo;{prompt.title}&rdquo;?
        </h2>
        <p className="text-sm text-muted-foreground">
          This permanently deletes the prompt and its text. This can&apos;t be undone.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button asChild variant="outline">
            <Link href={`/prompts/${prompt.id}`}>Cancel</Link>
          </Button>
          <DeletePromptButton promptId={prompt.id} />
        </div>
      </section>
    </>
  );
}
