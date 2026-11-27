"use client";

import { useState } from "react";
import { cn } from "cn";
import type { CategorySummary, PromptFieldErrors } from "@promptizer/shared";
import { PROMPT_TEXT_MAX_LENGTH, countCharacters } from "@promptizer/shared";
import { MarkdownPreview } from "@/components/markdown-preview";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

export interface PromptFormValues {
  title: string;
  text: string;
  categoryId: string | null;
}

interface PromptFormFieldsProps {
  values: PromptFormValues;
  categories: CategorySummary[];
  fieldErrors: PromptFieldErrors;
  onChange(values: PromptFormValues): void;
}

type EditorMode = "write" | "preview";

const EDITOR_MODES: { mode: EditorMode; label: string }[] = [
  { mode: "write", label: "Write" },
  { mode: "preview", label: "Preview" },
];

const EDITOR_PANE_CLASS = "min-h-80 rounded-lg";

function EditorModeToggle({ mode, onModeChange }: { mode: EditorMode; onModeChange(mode: EditorMode): void }) {
  return (
    <div role="group" aria-label="Editor mode" className="flex gap-1 lg:hidden">
      {EDITOR_MODES.map((option) => (
        <Button
          key={option.mode}
          type="button"
          variant={mode === option.mode ? "secondary" : "ghost"}
          aria-pressed={mode === option.mode}
          onClick={() => onModeChange(option.mode)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

function CharacterCount({ text }: { text: string }) {
  const characterCount = countCharacters(text);
  const overLimit = characterCount > PROMPT_TEXT_MAX_LENGTH;
  return (
    <p
      className={cn("text-xs", overLimit ? "text-destructive" : "text-muted-foreground")}
      data-testid="character-count"
    >
      {characterCount.toLocaleString("en-US")} / {PROMPT_TEXT_MAX_LENGTH.toLocaleString("en-US")} characters
    </p>
  );
}

export function PromptFormFields({ values, categories, fieldErrors, onChange }: PromptFormFieldsProps) {
  const [mode, setMode] = useState<EditorMode>("write");

  return (
    <FieldGroup>
      <div className={cn("grid gap-6", categories.length > 0 && "md:grid-cols-[minmax(0,1fr)_16rem]")}>
        <Field data-invalid={fieldErrors.title ? true : undefined}>
          <FieldLabel htmlFor="prompt-title">Title</FieldLabel>
          <Input
            id="prompt-title"
            name="title"
            value={values.title}
            onChange={(event) => onChange({ ...values, title: event.target.value })}
            aria-invalid={fieldErrors.title ? true : undefined}
          />
          {fieldErrors.title && <FieldError>{fieldErrors.title}</FieldError>}
        </Field>
        {categories.length > 0 && (
          <Field data-invalid={fieldErrors.categoryId ? true : undefined}>
            <FieldLabel htmlFor="prompt-category">Category</FieldLabel>
            <NativeSelect
              id="prompt-category"
              name="categoryId"
              value={values.categoryId ?? ""}
              onChange={(event) => onChange({ ...values, categoryId: event.target.value || null })}
              aria-invalid={fieldErrors.categoryId ? true : undefined}
            >
              <NativeSelectOption value="">No category</NativeSelectOption>
              {categories.map((category) => (
                <NativeSelectOption key={category.id} value={category.id}>
                  {category.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {fieldErrors.categoryId && <FieldError>{fieldErrors.categoryId}</FieldError>}
          </Field>
        )}
      </div>
      <Field data-invalid={fieldErrors.text ? true : undefined}>
        <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
          <FieldLabel htmlFor="prompt-text">Prompt text</FieldLabel>
          <EditorModeToggle mode={mode} onModeChange={setMode} />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Textarea
            id="prompt-text"
            name="text"
            value={values.text}
            onChange={(event) => onChange({ ...values, text: event.target.value })}
            aria-invalid={fieldErrors.text ? true : undefined}
            className={cn(EDITOR_PANE_CLASS, "font-mono", mode === "preview" && "max-lg:hidden")}
          />
          <section
            aria-label="Preview"
            className={cn(EDITOR_PANE_CLASS, "border p-4", mode === "write" && "max-lg:hidden")}
          >
            {values.text.trim() ? (
              <MarkdownPreview source={values.text} />
            ) : (
              <p className="text-sm text-muted-foreground">The formatted prompt appears here as you type.</p>
            )}
          </section>
        </div>
        <CharacterCount text={values.text} />
        {fieldErrors.text && <FieldError>{fieldErrors.text}</FieldError>}
      </Field>
    </FieldGroup>
  );
}
