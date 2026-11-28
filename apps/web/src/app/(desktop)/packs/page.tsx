import { AppPage } from "@/components/desktop/app-page";
import { PacksView } from "@/components/shared/packs-view";
import { loadPacksForSession } from "@/lib/server/prompt-pages";
import { requireSignedInUser } from "@/lib/server/page-session";

const PACKS_PATH = "/packs";

export default async function PacksPage() {
  await requireSignedInUser(PACKS_PATH);
  const packs = await loadPacksForSession();
  return (
    <AppPage path={PACKS_PATH}>
      <PacksView packs={packs} />
    </AppPage>
  );
}
