import { AppPage } from "@/components/mobile/app-page";
import { NewPackView } from "@/components/shared/new-pack-view";
import { requireSignedInUser } from "@/lib/server/page-session";

const NEW_PACK_PATH = "/packs/new";

export default async function NewPackPage() {
  await requireSignedInUser(NEW_PACK_PATH);
  return (
    <AppPage path={NEW_PACK_PATH}>
      <NewPackView />
    </AppPage>
  );
}
