import { PageHeader } from "@/components/page-header";
import { PackComposer } from "@/components/pack-composer";

const ALL_PACKS_BACK_LINK = { href: "/packs", label: "All packs" };

export function NewPackView() {
  return (
    <>
      <PageHeader title="New pack" back={ALL_PACKS_BACK_LINK} />
      <PackComposer />
    </>
  );
}
