import type { CategorySummary } from "@promptizer/shared";
import { PageHeader } from "@/components/page-header";
import { PackComposer } from "@/components/pack-composer";

const ALL_PACKS_BACK_LINK = { href: "/packs", label: "All packs" };

export function EditPackView({ pack }: { pack: CategorySummary }) {
  return (
    <>
      <PageHeader title="Rename pack" back={ALL_PACKS_BACK_LINK} />
      <PackComposer packId={pack.id} initialName={pack.name} />
    </>
  );
}
