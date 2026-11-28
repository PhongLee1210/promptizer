"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2Icon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { deleteCategoryRequest } from "@/lib/prompts/categories-client";
import { signInUrlFor } from "@/lib/safe-redirect";

const SOLID_DESTRUCTIVE_BUTTON_CLASS =
  "bg-destructive text-white hover:bg-destructive/90 dark:bg-red-700 dark:hover:bg-red-700/90";

export function DeletePackButton({ packId }: { packId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string>();

  async function handleDelete() {
    setBusy(true);
    setFailureMessage(undefined);
    const result = await deleteCategoryRequest(packId);
    if (result.ok || result.kind === "not_found") {
      router.replace("/packs");
      router.refresh();
      return;
    }
    setBusy(false);
    if (result.kind === "unauthenticated") {
      router.replace(signInUrlFor(pathname));
      return;
    }
    setFailureMessage(result.message);
  }

  return (
    <>
      {failureMessage && (
        <Alert variant="destructive" className="basis-full">
          <AlertDescription>{failureMessage}</AlertDescription>
        </Alert>
      )}
      <Button type="button" disabled={busy} onClick={handleDelete} className={SOLID_DESTRUCTIVE_BUTTON_CLASS}>
        <Trash2Icon aria-hidden="true" />
        {busy ? "Deleting…" : "Delete pack"}
      </Button>
    </>
  );
}
