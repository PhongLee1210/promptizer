import { AppPage } from "@/components/desktop/app-page";
import { NewPromptView } from "@/components/shared/new-prompt-view";
import { loadCategoriesForSession } from "@/lib/server/prompt-pages";
import { requireSignedInUser } from "@/lib/server/page-session";

const NEW_PROMPT_PATH = "/prompts/new";

export default async function NewPromptPage() {
  await requireSignedInUser(NEW_PROMPT_PATH);
  const categories = await loadCategoriesForSession();
  return (
    <AppPage path={NEW_PROMPT_PATH}>
      <NewPromptView categories={categories} />
    </AppPage>
  );
}
