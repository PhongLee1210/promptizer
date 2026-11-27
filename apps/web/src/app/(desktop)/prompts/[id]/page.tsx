import { AppPage } from "@/components/desktop/app-page";
import { PromptDetailView } from "@/components/shared/prompt-detail-view";
import { loadPromptOrNotFound } from "@/lib/server/prompt-pages";
import { requireSignedInUser } from "@/lib/server/page-session";

export default async function PromptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const path = `/prompts/${id}`;
  await requireSignedInUser(path);
  const prompt = await loadPromptOrNotFound(id);
  return (
    <AppPage path={path}>
      <PromptDetailView prompt={prompt} />
    </AppPage>
  );
}
