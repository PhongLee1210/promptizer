import { AppPage } from "@/components/mobile/app-page";
import { PromptsView } from "@/components/shared/prompts-view";

export default async function PromptsPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : q)?.trim() ?? "";
  return (
    <AppPage path={query ? `/prompts?q=${encodeURIComponent(query)}` : "/prompts"}>
      <PromptsView query={query} />
    </AppPage>
  );
}
