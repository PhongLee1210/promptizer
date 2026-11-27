import type { CategorySummary, Prompt } from "@promptizer/shared";
import { PromptEditor } from "@/components/prompt-editor";

export function EditPromptView({ prompt, categories }: { prompt: Prompt; categories: CategorySummary[] }) {
  return <PromptEditor key={prompt.id} prompt={prompt} categories={categories} />;
}
