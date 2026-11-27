"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import type { CategorySummary, PromptFieldErrors } from "@promptizer/shared";
import { PromptFormFields } from "@/components/prompt-form-fields";
import type { PromptFormValues } from "@/components/prompt-form-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { createPromptRequest } from "@/lib/prompts/prompt-client";
import { promptDraftProblems } from "@/lib/prompts/prompts";
import { signInUrlFor } from "@/lib/safe-redirect";

const EMPTY_PROMPT: PromptFormValues = { title: "", text: "", categoryId: null };

export function PromptComposer({ categories }: { categories: CategorySummary[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [values, setValues] = useState<PromptFormValues>(EMPTY_PROMPT);
  const [fieldErrors, setFieldErrors] = useState<PromptFieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    const problems = promptDraftProblems(values, "create");
    setFieldErrors(problems);
    if (Object.keys(problems).length > 0) {
      return;
    }
    setBusy(true);
    const result = await createPromptRequest(values);
    if (result.ok && result.prompt) {
      router.push(`/prompts/${result.prompt.id}`);
      return;
    }
    setBusy(false);
    if (result.ok) {
      setFormError("Something went wrong. Please try again.");
    } else if (result.kind === "unauthenticated") {
      router.replace(signInUrlFor(pathname));
    } else if (result.kind === "validation" && result.fields) {
      setFieldErrors(result.fields);
    } else {
      setFormError(result.message);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}
      <PromptFormFields values={values} categories={categories} fieldErrors={fieldErrors} onChange={setValues} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button asChild variant="outline">
          <Link href="/prompts">Cancel</Link>
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save prompt"}
        </Button>
      </div>
    </form>
  );
}
