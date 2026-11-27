import { AppPage } from "@/components/mobile/app-page";
import { DeletePromptView } from "@/components/shared/delete-prompt-view";
import { loadPromptOrNotFound } from "@/lib/server/prompt-pages";
import { requireSignedInUser } from "@/lib/server/page-session";

export default async function DeletePromptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const path = `/prompts/${id}/delete`;
  await requireSignedInUser(path);
  const prompt = await loadPromptOrNotFound(id);
  return (
    <AppPage path={path}>
      <DeletePromptView prompt={prompt} />
    </AppPage>
  );
}
