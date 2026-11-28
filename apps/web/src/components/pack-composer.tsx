"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import type { CategoryFieldErrors } from "@promptizer/shared";
import { PackFormFields } from "@/components/pack-form-fields";
import type { PackFormValues } from "@/components/pack-form-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { createCategoryRequest, renameCategoryRequest } from "@/lib/prompts/categories-client";
import { categoryDraftProblems } from "@/lib/prompts/categories";
import { signInUrlFor } from "@/lib/safe-redirect";

interface PackComposerProps {
  packId?: string;
  initialName?: string;
}

export function PackComposer({ packId, initialName = "" }: PackComposerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [values, setValues] = useState<PackFormValues>({ name: initialName });
  const [fieldErrors, setFieldErrors] = useState<CategoryFieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    const problems = categoryDraftProblems(values);
    setFieldErrors(problems);
    if (Object.keys(problems).length > 0) {
      return;
    }
    setBusy(true);
    const result = packId ? await renameCategoryRequest(packId, values) : await createCategoryRequest(values);
    if (result.ok) {
      router.push("/packs");
      router.refresh();
      return;
    }
    setBusy(false);
    if (result.kind === "unauthenticated") {
      router.replace(signInUrlFor(pathname));
    } else if (result.kind === "validation" && result.fields) {
      setFieldErrors(result.fields);
    } else {
      setFormError(result.message);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex max-w-sm flex-col gap-6">
      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}
      <PackFormFields values={values} fieldErrors={fieldErrors} onChange={setValues} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button asChild variant="outline">
          <Link href="/packs">Cancel</Link>
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : packId ? "Save pack" : "Create pack"}
        </Button>
      </div>
    </form>
  );
}
