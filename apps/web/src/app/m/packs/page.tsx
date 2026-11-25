import { AppPage } from "@/components/mobile/app-page";
import { PacksView } from "@/components/shared/packs-view";

export default function PacksPage() {
  return (
    <AppPage path="/packs">
      <PacksView />
    </AppPage>
  );
}
