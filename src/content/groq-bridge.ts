import { browser } from "wxt/browser";
import type { RefineResult } from "./action-types";

export interface GroqRefineMessage {
  type: "PROMPTIZER_GROQ_REFINE";
  prompt: string;
}

interface GroqRefineResponse {
  ok: boolean;
  decision?: "keep" | "refine";
  refinedPrompt?: string;
  reason?: "not-configured";
}

export async function refineViaGroqLoopback(text: string): Promise<RefineResult> {
  const message: GroqRefineMessage = { type: "PROMPTIZER_GROQ_REFINE", prompt: text };
  let response: GroqRefineResponse;
  try {
    response = (await browser.runtime.sendMessage(message)) as GroqRefineResponse;
  } catch {
    return { decision: "error" };
  }
  if (response === undefined || !response.ok || response.decision === undefined) {
    return { decision: "error", reason: response?.reason };
  }
  return response.decision === "refine"
    ? { decision: "refine", refinedText: response.refinedPrompt }
    : { decision: "keep" };
}
