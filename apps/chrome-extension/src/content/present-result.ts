import type { ActionId, RefineResult } from "./action-types";
import type { Outcome } from "./chip-state";

export interface ActionCopy {
  readonly label: string;
  readonly busyLabel: string;
  readonly resultTitle: string;
}

export const ERROR_MESSAGE = "Couldn't get a result. Your text is unchanged.";
export const NOT_CONFIGURED_MESSAGE =
  "On-device AI isn't ready yet. Open the Promptizer popup and follow the On-device AI setup steps.";
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
