import { AppPage } from "@/components/mobile/app-page";
import { ChangePasswordView } from "@/components/shared/change-password-view";

export default function ChangePasswordPage() {
  return (
    <AppPage path="/account/password">
      <ChangePasswordView />
    </AppPage>
  );
}
