import Link from "next/link";
import type { CategorySummary } from "@promptizer/shared";
import { DeletePackButton } from "@/components/delete-pack-button";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

const ALL_PACKS_BACK_LINK = { href: "/packs", label: "All packs" };

export function DeletePackView({ pack }: { pack: CategorySummary }) {
  return (
    <>
      <PageHeader title="Delete pack" back={ALL_PACKS_BACK_LINK} />
      <section aria-labelledby="delete-pack-question" className="flex max-w-xl flex-col gap-4 rounded-xl border p-6">
        <h2 id="delete-pack-question" className="text-base font-semibold break-words">
          Delete &ldquo;{pack.name}&rdquo;?
        </h2>
        <p className="text-sm text-muted-foreground">
          This permanently deletes the pack. Prompts in it are kept — they just lose this pack and stay listed under All
          prompts.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button asChild variant="outline">
            <Link href="/packs">Cancel</Link>
          </Button>
          <DeletePackButton packId={pack.id} />
        </div>
      </section>
    </>
  );
}
