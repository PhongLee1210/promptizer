import type { CategorySummary } from "@promptizer/shared";
import { PageHeader } from "@/components/page-header";
import { PromptComposer } from "@/components/prompt-composer";
import { ALL_PROMPTS_BACK_LINK } from "@/components/prompt-page-layout";

export function NewPromptView({ categories }: { categories: CategorySummary[] }) {
  return (
    <>
      <PageHeader title="New prompt" back={ALL_PROMPTS_BACK_LINK} />
      <PromptComposer categories={categories} />
    </>
  );
}
