"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { signInUrlFor } from "../lib/safe-redirect.ts";
import type { AuthErrorBody, AuthFieldErrors } from "@promptizer/shared";

export interface FormField {
  name: string;
  label: string;
  type: "text" | "email" | "password";
  autoComplete: string;
}

interface AuthFormProps {
  endpoint: string;
  fields: FormField[];
  submitLabel: string;
  successDestination: string;
  successMessage?: string;
  confirmPasswordField?: { name: string; mustMatch: string };
}

const NETWORK_ERROR = "Couldn't reach Promptizer. Check your connection and try again.";

export function AuthForm({
  endpoint,
  fields,
  submitLabel,
  successDestination,
  successMessage,
  confirmPasswordField,
}: AuthFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors & Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = Object.fromEntries(fields.map(({ name }) => [name, String(formData.get(name) ?? "")]));
    setFormError(undefined);
    setNotice(undefined);
    if (confirmPasswordField && payload[confirmPasswordField.name] !== payload[confirmPasswordField.mustMatch]) {
      setFieldErrors({ [confirmPasswordField.name]: "The passwords do not match." });
      return;
    }
    setFieldErrors({});
    setBusy(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        form.reset();
        if (successMessage) {
          setNotice(successMessage);
        }
        router.replace(successDestination);
        router.refresh();
        return;
      }
      const body = (await response.json().catch(() => undefined)) as AuthErrorBody | undefined;
      if (body?.code === "unauthenticated") {
        router.replace(signInUrlFor(pathname));
        return;
      }
      setFieldErrors(body?.fields ?? {});
      setFormError(body && !body.fields ? body.message : body ? undefined : NETWORK_ERROR);
    } catch {
      setFormError(NETWORK_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FieldGroup>
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
        {notice && (
          <Alert>
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}
        {fields.map((field) => (
          <Field key={field.name} data-invalid={fieldErrors[field.name] ? true : undefined}>
            <FieldLabel htmlFor={field.name}>{field.label}</FieldLabel>
            <Input
              id={field.name}
              name={field.name}
              type={field.type}
              autoComplete={field.autoComplete}
              required
              aria-invalid={fieldErrors[field.name] ? true : undefined}
            />
            {fieldErrors[field.name] && <FieldError>{fieldErrors[field.name]}</FieldError>}
          </Field>
        ))}
        <Button type="submit" disabled={busy}>
          {busy ? "Please wait…" : submitLabel}
        </Button>
      </FieldGroup>
    </form>
  );
}
