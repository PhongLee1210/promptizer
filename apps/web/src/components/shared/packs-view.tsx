import { LayersIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export function PacksView() {
  return (
    <>
      <PageHeader title="Prompt packs" count={0} />
      <EmptyState
        icon={LayersIcon}
        title="No packs yet"
        description="Packs group related prompts so you can find them together. Start by creating a prompt."
        action={{ label: "Create a prompt", href: "/prompts/new" }}
      />
    </>
  );
}
