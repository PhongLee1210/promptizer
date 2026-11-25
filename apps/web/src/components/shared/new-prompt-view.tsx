import { SquarePenIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export function NewPromptView() {
  return (
    <>
      <PageHeader title="New prompt" />
      <EmptyState
        icon={SquarePenIcon}
        title="The editor is coming soon"
        description="Writing and saving prompts arrives in an upcoming release. Your prompt library is ready for it."
        action={{ label: "Back to all prompts", href: "/prompts" }}
      />
    </>
  );
}
