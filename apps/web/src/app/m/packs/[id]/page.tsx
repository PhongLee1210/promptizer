import { AppPage } from "@/components/mobile/app-page";
import { PackView } from "@/components/shared/pack-view";
import { loadPackOrNotFound, loadPackPromptsForSession } from "@/lib/server/prompt-pages";
import { requireSignedInUser } from "@/lib/server/page-session";

export default async function PackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const path = `/packs/${id}`;
  await requireSignedInUser(path);
  const pack = await loadPackOrNotFound(id);
  const prompts = await loadPackPromptsForSession(id);
  return (
    <AppPage path={path}>
      <PackView pack={pack} prompts={prompts} />
    </AppPage>
  );
}
