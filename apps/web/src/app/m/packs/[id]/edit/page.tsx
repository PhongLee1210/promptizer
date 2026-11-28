import { AppPage } from "@/components/mobile/app-page";
import { EditPackView } from "@/components/shared/edit-pack-view";
import { loadPackOrNotFound } from "@/lib/server/prompt-pages";
import { requireSignedInUser } from "@/lib/server/page-session";

export default async function EditPackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const path = `/packs/${id}/edit`;
  await requireSignedInUser(path);
  const pack = await loadPackOrNotFound(id);
  return (
    <AppPage path={path}>
      <EditPackView pack={pack} />
    </AppPage>
  );
}
