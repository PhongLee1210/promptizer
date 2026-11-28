"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { savePromptRequest } from "@/lib/prompts/prompt-client";
import { signInUrlFor } from "@/lib/safe-redirect";

export function RemoveFromPackButton({ promptId }: { promptId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);

  async function handleRemove() {
    setBusy(true);
    const result = await savePromptRequest(promptId, { categoryId: null }, { keepalive: false });
    if (result.ok || result.kind === "not_found") {
      router.refresh();
      return;
    }
    setBusy(false);
    if (result.kind === "unauthenticated") {
      router.replace(signInUrlFor(pathname));
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      disabled={busy}
      onClick={handleRemove}
      aria-label="Remove from pack"
      className="absolute top-2 right-2 bg-background"
    >
      <XIcon aria-hidden="true" />
    </Button>
  );
}
