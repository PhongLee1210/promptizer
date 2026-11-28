import { AppPage } from "@/components/desktop/app-page";
import { DeletePackView } from "@/components/shared/delete-pack-view";
import { loadPackOrNotFound } from "@/lib/server/prompt-pages";
import { requireSignedInUser } from "@/lib/server/page-session";

export default async function DeletePackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const path = `/packs/${id}/delete`;
  await requireSignedInUser(path);
  const pack = await loadPackOrNotFound(id);
  return (
    <AppPage path={path}>
      <DeletePackView pack={pack} />
    </AppPage>
  );
}
