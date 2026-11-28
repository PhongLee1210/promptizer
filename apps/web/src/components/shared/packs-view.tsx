import Link from "next/link";
import { FolderIcon, PencilIcon, Trash2Icon } from "lucide-react";
import type { PackSummary } from "@promptizer/shared";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const NEW_PACK_ACTION = { label: "New pack", href: "/packs/new" };

export function PacksView({ packs }: { packs: PackSummary[] }) {
  return (
    <>
      <PageHeader
        title="Packs"
        count={packs.length}
        actions={
          <Button asChild>
            <Link href={NEW_PACK_ACTION.href}>{NEW_PACK_ACTION.label}</Link>
          </Button>
        }
      />
      {packs.length === 0 ? (
        <EmptyState
          icon={FolderIcon}
          title="No packs yet"
          description="Packs group related prompts together. Create one to start organizing your prompts."
          action={NEW_PACK_ACTION}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {packs.map((pack) => (
            <li key={pack.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
              <div className="flex min-w-0 items-center gap-2">
                <FolderIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate font-medium">{pack.name}</span>
                <Badge variant="secondary">{pack.promptCount}</Badge>
              </div>
              <div className="flex gap-2">
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
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
