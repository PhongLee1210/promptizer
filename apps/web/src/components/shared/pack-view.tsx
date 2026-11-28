import Link from "next/link";
import { FolderIcon, PencilIcon, Trash2Icon } from "lucide-react";
import type { CategorySummary, Prompt } from "@promptizer/shared";
import { AddToPackPicker } from "@/components/add-to-pack-picker";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { PromptCard } from "@/components/prompt-card";
import { PromptGrid } from "@/components/prompt-grid";
import { RemoveFromPackButton } from "@/components/remove-from-pack-button";
import { Button } from "@/components/ui/button";

const ALL_PACKS_BACK_LINK = { href: "/packs", label: "All packs" };

export function PackView({ pack, prompts }: { pack: CategorySummary; prompts: Prompt[] }) {
  return (
    <>
      <PageHeader
        title={pack.name}
        count={prompts.length}
        back={ALL_PACKS_BACK_LINK}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={`/packs/${pack.id}/edit`}>
                <PencilIcon aria-hidden="true" />
                Rename
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/packs/${pack.id}/delete`}>
                <Trash2Icon aria-hidden="true" />
                Delete
              </Link>
            </Button>
          </>
        }
      />
      <AddToPackPicker packId={pack.id} />
      {prompts.length === 0 ? (
        <EmptyState
          icon={FolderIcon}
          title="This pack is empty"
          description="Add prompts to this pack from a prompt's page, or create a new one here."
          action={{ label: "New prompt", href: "/prompts/new" }}
        />
      ) : (
        <PromptGrid>
          {prompts.map((prompt) => (
            <div key={prompt.id} className="relative">
              <PromptCard prompt={prompt} />
              <RemoveFromPackButton promptId={prompt.id} />
            </div>
          ))}
        </PromptGrid>
      )}
    </>
  );
}
