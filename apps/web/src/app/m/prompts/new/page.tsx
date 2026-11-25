import { AppPage } from "@/components/mobile/app-page";
import { NewPromptView } from "@/components/shared/new-prompt-view";

export default function NewPromptPage() {
  return (
    <AppPage path="/prompts/new">
      <NewPromptView />
    </AppPage>
  );
}
