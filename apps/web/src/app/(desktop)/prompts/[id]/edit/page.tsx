import { AppPage } from "@/components/desktop/app-page";
import { EditPromptView } from "@/components/shared/edit-prompt-view";
import { loadCategoriesForSession, loadPromptOrNotFound } from "@/lib/server/prompt-pages";
import { requireSignedInUser } from "@/lib/server/page-session";

export default async function EditPromptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const path = `/prompts/${id}/edit`;
  await requireSignedInUser(path);
  const [prompt, categories] = await Promise.all([loadPromptOrNotFound(id), loadCategoriesForSession()]);
  return (
    <AppPage path={path}>
      <EditPromptView prompt={prompt} categories={categories} />
    </AppPage>
  );
}
