import type { ActionId, RefineResult } from "./action-types";
import type { Outcome } from "./chip-state";
import type { PromptWriteFailure } from "../prompts/save-prompt-message";

export interface ActionCopy {
  readonly label: string;
  readonly busyLabel: string;
  readonly resultTitle: string;
}

export const ERROR_MESSAGE = "Couldn't get a result. Your text is unchanged.";
export const NOT_CONFIGURED_MESSAGE =
  "On-device AI isn't ready yet. Open the Promptizer popup and follow the On-device AI setup steps.";
export const OFFLINE_SAVE_MESSAGE = "You're offline. Your library is read-only until you reconnect.";
export const UNREACHABLE_WRITE_MESSAGE =
  "Couldn't reach Promptizer, so nothing changed. Check your connection and retry.";
export const SIGNED_OUT_WRITE_MESSAGE = "Your Promptizer session ended. Sign in again from the Promptizer popup.";
export const PREPARING_TITLE = "Setting up on-device AI";
export const PREPARING_CAPTION = "Downloading Gemini Nano. Keep Chrome open; this happens once per computer.";

export const ACTION_COPY: Record<ActionId, ActionCopy> = {
  refine: { label: "Refine prompt", busyLabel: "Refining", resultTitle: "Refined prompt" },
  improve: { label: "Improve writing", busyLabel: "Improving", resultTitle: "Improved" },
  grammar: { label: "Fix grammar", busyLabel: "Fixing grammar", resultTitle: "Grammar fixed" },
  shorten: { label: "Shorten", busyLabel: "Shortening", resultTitle: "Shortened" },
  vi: { label: "Vietnamese", busyLabel: "Translating", resultTitle: "Vietnamese" },
  en: { label: "English", busyLabel: "Translating", resultTitle: "English" },
  pro: { label: "Professional", busyLabel: "Rewriting", resultTitle: "Professional tone" },
  friendly: { label: "Friendly", busyLabel: "Rewriting", resultTitle: "Friendly tone" },
  direct: { label: "Direct", busyLabel: "Rewriting", resultTitle: "Direct tone" },
};

export type WriteFailureRecovery = "retry" | "fix-input" | "blocked";

export interface WriteFailureNotice {
  message: string;
  recovery: WriteFailureRecovery;
}

export function describeWriteFailure(failure: PromptWriteFailure, online: boolean): WriteFailureNotice {
  switch (failure.kind) {
    case "retryable":
      return { message: online ? UNREACHABLE_WRITE_MESSAGE : OFFLINE_SAVE_MESSAGE, recovery: "retry" };
    case "unauthenticated":
      return { message: SIGNED_OUT_WRITE_MESSAGE, recovery: "blocked" };
    case "not_found":
      return { message: failure.message, recovery: "blocked" };
    case "validation":
      return { message: failure.message, recovery: "fix-input" };
  }
}

export interface PresentResultInput {
  action: ActionId;
  result: RefineResult;
  originalText: string;
}

export function presentResult({ action, result, originalText }: PresentResultInput): Outcome {
  if (result.decision === "error") {
    return { kind: "error", message: result.reason === "not-configured" ? NOT_CONFIGURED_MESSAGE : ERROR_MESSAGE };
  }
  const suggestion = result.decision === "refine" ? (result.refinedText ?? "").trim() : "";
  const text = suggestion.length > 0 ? suggestion : originalText.trim();
  return { kind: "ok", title: ACTION_COPY[action].resultTitle, text };
}
