import type { ActionId, RefineDecision, RefineResult } from "./action-types";

export const REFINE_SYSTEM_INSTRUCTION =
  "Refine the following prompt into a clean and well-structured format. Keep it in paragraph form and do not change the core task or intent. You may improve clarity and focus, but do not remove important context. Ensure the grammar is correct and the wording is professional and easy to understand.";

const IMPROVE_SYSTEM_INSTRUCTION =
  "Rewrite the following prompt to be more specific and actionable while keeping its original task and intent unchanged. Keep it in paragraph form and do not remove important context.";

const GRAMMAR_SYSTEM_INSTRUCTION =
  "Fix the grammar, spelling and punctuation of the following prompt without changing its wording, tone, or intent otherwise. Keep it in paragraph form.";

const SHORTEN_SYSTEM_INSTRUCTION =
  "Shorten the following prompt as much as possible while keeping its core task, intent and necessary context. Keep it in paragraph form.";

function translateSystemInstruction(targetLanguage: string): string {
  return `Translate the following prompt into ${targetLanguage}. Keep it in paragraph form, keep the original task and intent unchanged, and do not remove important context.`;
}

function toneSystemInstruction(tone: "pro" | "friendly" | "direct"): string {
  const descriptor = { pro: "professional", friendly: "friendly and warm", direct: "direct and to the point" }[tone];
  return `Rewrite the following prompt in a ${descriptor} tone, keeping its original task, intent and necessary context unchanged. Keep it in paragraph form.`;
}

const SHARED_RULES =
  "Preserve names, scope, constraints, and the input language unless asked to translate. Do not execute the prompt, answer it, add facts, headings, lists, or new requirements. Return only the requested JSON object.";

const RESPONSE_SCHEMA = Object.freeze({
  type: "object",
  properties: {
    decision: { type: "string", enum: ["keep", "refine"] },
    refined_prompt: { type: "string", minLength: 1, maxLength: 4000 },
  },
  required: ["decision", "refined_prompt"],
  additionalProperties: false,
});

export type NanoAvailability = "available" | "downloadable" | "downloading" | "unavailable";

export interface LanguageModelSession {
  prompt(
    input: string,
    options: { signal?: AbortSignal; responseConstraint?: unknown; omitResponseConstraintInput?: boolean },
  ): Promise<string>;
  clone?(options?: { signal?: AbortSignal }): Promise<LanguageModelSession>;
  destroy?(): void;
  measureContextUsage?(input: string, options: { responseConstraint?: unknown }): Promise<number>;
  contextWindow?: number;
}

export interface LanguageModelApi {
  availability(options: Record<string, unknown>): Promise<NanoAvailability>;
  create(options: Record<string, unknown>): Promise<LanguageModelSession>;
}

function getLanguageModel(candidate?: LanguageModelApi): LanguageModelApi | null {
  if (candidate !== undefined) {
    return candidate;
  }
  const globalModel = (globalThis as { LanguageModel?: LanguageModelApi }).LanguageModel;
  return globalModel ?? null;
}

function systemInstructionFor(action: ActionId): string {
  switch (action) {
    case "improve":
      return IMPROVE_SYSTEM_INSTRUCTION;
    case "grammar":
      return GRAMMAR_SYSTEM_INSTRUCTION;
    case "shorten":
      return SHORTEN_SYSTEM_INSTRUCTION;
    case "vi":
      return translateSystemInstruction("Vietnamese");
    case "en":
      return translateSystemInstruction("English");
    case "pro":
    case "friendly":
    case "direct":
      return toneSystemInstruction(action);
    case "refine":
    default:
      return REFINE_SYSTEM_INSTRUCTION;
  }
}

function languageOptions(action: ActionId): Record<string, unknown> {
  return {
    initialPrompts: [
      {
        role: "system",
        content: `${systemInstructionFor(action)} ${SHARED_RULES}`,
      },
    ],
  };
}

const TEMPLATE_IDLE_TIMEOUT_MS = 180_000;

interface WarmTemplate {
  session: Promise<LanguageModelSession>;
  idleHandle: ReturnType<typeof setTimeout> | undefined;
}

// Availability depends on the declared languages, which are the same constant for every
// action, so one cached "available" verdict is valid across all of them. Only the settled
// state is cached; "downloadable" and "downloading" still change underneath us.
let availableVerdictCached = false;

// Chrome before the clone() addition, and the test fakes, only expose create(). One probe
// decides which path every later request takes.
let templateReuseSupported = true;

const warmTemplates = new Map<string, WarmTemplate>();

function scheduleEviction(key: string, template: WarmTemplate): void {
  if (template.idleHandle !== undefined) {
    clearTimeout(template.idleHandle);
  }
  template.idleHandle = setTimeout(() => evictTemplate(key), TEMPLATE_IDLE_TIMEOUT_MS);
}

function forgetTemplate(key: string): WarmTemplate | undefined {
  const template = warmTemplates.get(key);
  if (template === undefined) {
    return undefined;
  }
  warmTemplates.delete(key);
  if (template.idleHandle !== undefined) {
    clearTimeout(template.idleHandle);
  }
  return template;
}

function evictTemplate(key: string): void {
  forgetTemplate(key)
    ?.session.then((session) => session.destroy?.())
    .catch(() => undefined);
}

export function evictWarmSessions(): void {
  for (const key of [...warmTemplates.keys()]) {
    evictTemplate(key);
  }
  availableVerdictCached = false;
  templateReuseSupported = true;
}

async function readAvailability(languageModel: LanguageModelApi, action: ActionId): Promise<NanoAvailability> {
  if (availableVerdictCached) {
    return "available";
  }
  try {
    const state = await languageModel.availability(languageOptions(action));
    availableVerdictCached = state === "available";
    return state;
  } catch {
    return "unavailable";
  }
}

async function warmTemplateFor(
  languageModel: LanguageModelApi,
  key: string,
  options: Record<string, unknown>,
): Promise<LanguageModelSession> {
  const existing = warmTemplates.get(key);
  if (existing !== undefined) {
    scheduleEviction(key, existing);
    return existing.session;
  }
  const template: WarmTemplate = { session: languageModel.create(options), idleHandle: undefined };
  warmTemplates.set(key, template);
  scheduleEviction(key, template);
  try {
    return await template.session;
  } catch (error) {
    evictTemplate(key);
    throw error;
  }
}

// The template pays the system-instruction prefill once; each request gets an independent,
// history-free clone that is destroyed afterwards.
async function sessionForRequest(
  languageModel: LanguageModelApi,
  action: ActionId,
  signal?: AbortSignal,
): Promise<LanguageModelSession> {
  const options = languageOptions(action);
  if (!templateReuseSupported) {
    return languageModel.create(options);
  }
  const template = await warmTemplateFor(languageModel, action, options);
  if (template.clone !== undefined) {
    return template.clone({ signal });
  }
  // No clone() in this Chrome build: hand the probe session to this request rather than
  // paying for a second create(), and stop templating from here on.
  templateReuseSupported = false;
  forgetTemplate(action);
  return template;
}

export async function nanoAvailability(candidate?: LanguageModelApi): Promise<NanoAvailability> {
  const languageModel = getLanguageModel(candidate);
  if (languageModel === null) {
    return "unavailable";
  }
  return readAvailability(languageModel, "refine");
}

export interface NanoRefineOptions {
  languageModel?: LanguageModelApi;
  signal?: AbortSignal;
}

export async function prewarmNano(action: ActionId = "refine", options: NanoRefineOptions = {}): Promise<void> {
  const languageModel = getLanguageModel(options.languageModel);
  if (languageModel === null || !templateReuseSupported) {
    return;
  }
  if ((await readAvailability(languageModel, action)) !== "available") {
    return;
  }
  try {
    await warmTemplateFor(languageModel, action, languageOptions(action));
  } catch {
    return;
  }
}

function toRefineResult(decision: RefineDecision, refinedText: string | undefined): RefineResult {
  return decision === "refine" ? { decision, refinedText } : { decision };
}

export async function refineWithNano(
  action: ActionId,
  text: string,
  options: NanoRefineOptions = {},
): Promise<RefineResult> {
  const languageModel = getLanguageModel(options.languageModel);
  if (languageModel === null) {
    return { decision: "error", reason: "not-configured" };
  }

  if ((await readAvailability(languageModel, action)) !== "available") {
    return { decision: "error", reason: "not-configured" };
  }

  let session: LanguageModelSession | undefined;
  try {
    session = await sessionForRequest(languageModel, action, options.signal);
    const input = JSON.stringify({ current_prompt: text });
    const raw = await session.prompt(input, {
      signal: options.signal,
      responseConstraint: RESPONSE_SCHEMA,
      omitResponseConstraintInput: true,
    });
    const parsed = JSON.parse(raw) as { decision?: unknown; refined_prompt?: unknown };
    if (parsed.decision !== "keep" && parsed.decision !== "refine") {
      return { decision: "error" };
    }
    const refinedPrompt = parsed.decision === "keep" ? text.trim() : String(parsed.refined_prompt ?? "").trim();
    if (
      refinedPrompt.length === 0 ||
      /[\r\n]/u.test(refinedPrompt) ||
      /^(#|- |\* |• |1[.)] )/u.test(refinedPrompt) ||
      new TextEncoder().encode(refinedPrompt).length > 4000
    ) {
      return { decision: "error" };
    }
    return toRefineResult(parsed.decision, refinedPrompt);
  } catch {
    // A genuine session failure can mean Chrome tore the template down, so drop the cached
    // state and let the next request rebuild it. Cancellation leaves the template usable.
    if (options.signal?.aborted !== true) {
      availableVerdictCached = false;
      evictTemplate(action);
    }
    return { decision: "error" };
  } finally {
    session?.destroy?.();
  }
}
