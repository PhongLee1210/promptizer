"use client";

import { useEffect, useRef, useState } from "react";
import type { CategorySummary, Prompt, PromptFieldErrors } from "@promptizer/shared";
import { PageHeader } from "@/components/page-header";
import { PromptFormFields } from "@/components/prompt-form-fields";
import { promptBackLink } from "@/components/prompt-page-layout";
import type { PromptFormValues } from "@/components/prompt-form-fields";
import { Button } from "@/components/ui/button";
import { AUTO_SAVE_DELAY_MS, createAutoSaver } from "@/lib/prompts/auto-save";
import type { AutoSaveState, AutoSaver } from "@/lib/prompts/auto-save";
import { savePromptRequest, toSaveResult } from "@/lib/prompts/prompt-client";
import { promptDraftProblems } from "@/lib/prompts/prompts";

const LEAVE_CONFIRMATION = "You have unsaved changes. Leave this page?";
const INITIAL_SAVE_STATE: AutoSaveState = { status: "idle", canRetry: false };

function isSameDraft(first: PromptFormValues, second: PromptFormValues): boolean {
  return first.title === second.title && first.text === second.text && first.categoryId === second.categoryId;
}

function toFormValues(prompt: Prompt): PromptFormValues {
  return { title: prompt.title, text: prompt.text, categoryId: prompt.category?.id ?? null };
}

function isPlainLeftClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function inAppDestination(event: MouseEvent): URL | undefined {
  const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(anchor instanceof HTMLAnchorElement) || (anchor.target && anchor.target !== "_self") || anchor.download) {
    return undefined;
  }
  const destination = new URL(anchor.href, window.location.href);
  const current = new URL(window.location.href);
  const leavesPage = destination.pathname !== current.pathname || destination.search !== current.search;
  return destination.origin === current.origin && leavesPage ? destination : undefined;
}

function SaveStatus({ state, invalid, onRetry }: { state: AutoSaveState; invalid: boolean; onRetry(): void }) {
  if (invalid) {
    return <span className="text-destructive">Fix the highlighted fields to save</span>;
  }
  switch (state.status) {
    case "idle":
      return <span className="text-muted-foreground">No changes yet</span>;
    case "pending":
      return <span className="text-muted-foreground">Unsaved changes</span>;
    case "saving":
      return <span className="text-muted-foreground">Saving…</span>;
    case "saved":
      return <span className="text-muted-foreground">Saved</span>;
    case "failed":
      return (
        <span className="flex flex-wrap items-center gap-2 text-destructive">
          {state.failureMessage}
          {state.canRetry && (
            <Button type="button" variant="outline" onClick={onRetry}>
              Retry
            </Button>
          )}
        </span>
      );
  }
}

export function PromptEditor({ prompt, categories }: { prompt: Prompt; categories: CategorySummary[] }) {
  const [values, setValues] = useState<PromptFormValues>(() => toFormValues(prompt));
  const [saveState, setSaveState] = useState<AutoSaveState>(INITIAL_SAVE_STATE);
  const [fieldErrors, setFieldErrors] = useState<PromptFieldErrors>({});
  const saverRef = useRef<AutoSaver<PromptFormValues> | undefined>(undefined);
  const invalidDraftRef = useRef(false);
  const leaveConfirmedRef = useRef(false);
  const promptId = prompt.id;

  useEffect(() => {
    const saver = createAutoSaver<PromptFormValues>({
      initialDraft: toFormValues(prompt),
      delayMs: AUTO_SAVE_DELAY_MS,
      isSameDraft,
      onStateChange: setSaveState,
      async save(draft, { keepalive }) {
        const result = await savePromptRequest(promptId, draft, { keepalive });
        if (!result.ok && result.kind === "validation" && result.fields) {
          setFieldErrors(result.fields);
        }
        return toSaveResult(result);
      },
    });
    saverRef.current = saver;
    const flushOnPageHide = () => saver.flush();
    window.addEventListener("pagehide", flushOnPageHide);
    return () => {
      window.removeEventListener("pagehide", flushOnPageHide);
      saver.flush();
      saver.stop();
      saverRef.current = undefined;
    };
  }, [promptId]);

  useEffect(() => {
    const hasUnsavedChanges = () =>
      !leaveConfirmedRef.current && Boolean(saverRef.current?.hasUnsavedChanges() || invalidDraftRef.current);

    function warnBeforeUnload(event: BeforeUnloadEvent) {
      if (hasUnsavedChanges()) {
        event.preventDefault();
        event.returnValue = "";
      }
    }

    function guardInAppNavigation(event: MouseEvent) {
      if (event.defaultPrevented || !isPlainLeftClick(event) || !inAppDestination(event) || !hasUnsavedChanges()) {
        return;
      }
      if (window.confirm(LEAVE_CONFIRMATION)) {
        leaveConfirmedRef.current = true;
        saverRef.current?.flush();
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
    }

    window.addEventListener("beforeunload", warnBeforeUnload);
    window.addEventListener("click", guardInAppNavigation, { capture: true });
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      window.removeEventListener("click", guardInAppNavigation, { capture: true });
    };
  }, []);

  function handleChange(next: PromptFormValues) {
    setValues(next);
    const problems = promptDraftProblems(next, "create");
    setFieldErrors(problems);
    invalidDraftRef.current = Object.keys(problems).length > 0;
    if (!invalidDraftRef.current) {
      saverRef.current?.edit(next);
    }
  }

  const invalid = Object.keys(promptDraftProblems(values, "create")).length > 0;

  return (
    <>
      <PageHeader
        title={values.title.trim() || "Untitled prompt"}
        back={promptBackLink(promptId)}
        actions={
          <p role="status" aria-live="polite" className="flex min-h-8 items-center text-sm" data-testid="save-status">
            <SaveStatus state={saveState} invalid={invalid} onRetry={() => saverRef.current?.retry()} />
          </p>
        }
      />
      <PromptFormFields values={values} categories={categories} fieldErrors={fieldErrors} onChange={handleChange} />
    </>
  );
}
