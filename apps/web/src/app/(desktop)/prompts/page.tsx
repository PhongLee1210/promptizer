import { AppPage } from "@/components/desktop/app-page";
import { PromptsView } from "@/components/shared/prompts-view";
import { parsePromptsListParams, promptsListHref } from "@/lib/prompts/prompts";

export default async function PromptsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; tag?: string | string[]; view?: string | string[] }>;
}) {
  const params = parsePromptsListParams(await searchParams);
  return (
    <AppPage path={promptsListHref(params)}>
      <PromptsView params={params} />
    </AppPage>
  );
}
