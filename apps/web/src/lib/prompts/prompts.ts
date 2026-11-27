import {
  PROMPT_SEARCH_MAX_LENGTH,
  PROMPT_TEXT_MAX_LENGTH,
  PROMPT_TITLE_MAX_LENGTH,
  countCharacters,
} from "@promptizer/shared";
import type { PromptFieldErrors, PromptModel } from "@promptizer/shared";

export type PromptSource = "ChatGPT" | "Claude" | "Gemini";

export const SOURCE_LABEL_BY_MODEL: Record<PromptModel, PromptSource> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
};

export type PromptsDisplayMode = "cards" | "table";

export interface PromptsListParams {
  query: string;
  tag: string;
  category: string;
  page: number;
  view: PromptsDisplayMode;
}

export const DEFAULT_PROMPTS_VIEW: PromptsDisplayMode = "cards";

const PROMPT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UNSUPPORTED_TEXT_CHARACTER = "\u0000";

export function isPromptId(value: string): boolean {
  return PROMPT_ID_PATTERN.test(value);
}

export function normalizePromptTitle(title: string): string {
  return title.trim();
}

function titleProblem(title: unknown): string | undefined {
  if (typeof title !== "string" || normalizePromptTitle(title) === "") {
    return "Enter a title.";
  }
  if (countCharacters(normalizePromptTitle(title)) > PROMPT_TITLE_MAX_LENGTH) {
    return `Use at most ${PROMPT_TITLE_MAX_LENGTH} characters.`;
  }
  if (title.includes(UNSUPPORTED_TEXT_CHARACTER)) {
    return "Remove unsupported characters.";
  }
  return undefined;
}

function textProblem(text: unknown): string | undefined {
  if (typeof text !== "string" || text.trim() === "") {
    return "Enter the prompt text.";
  }
  if (countCharacters(text) > PROMPT_TEXT_MAX_LENGTH) {
    return `Use at most ${PROMPT_TEXT_MAX_LENGTH.toLocaleString("en-US")} characters.`;
  }
  if (text.includes(UNSUPPORTED_TEXT_CHARACTER)) {
    return "Remove unsupported characters.";
  }
  return undefined;
}

function categoryIdProblem(categoryId: unknown): string | undefined {
  if (categoryId === undefined || categoryId === null) {
    return undefined;
  }
  return typeof categoryId === "string" && isPromptId(categoryId) ? undefined : "Choose one of your categories.";
}

export function promptDraftProblems(
  draft: { title?: unknown; text?: unknown; categoryId?: unknown },
  mode: "create" | "update",
): PromptFieldErrors {
  const checkAll = mode === "create";
  const problems: PromptFieldErrors = {};
  const title = checkAll || "title" in draft ? titleProblem(draft.title) : undefined;
  const text = checkAll || "text" in draft ? textProblem(draft.text) : undefined;
  const categoryId = categoryIdProblem(draft.categoryId);
  if (title) problems.title = title;
  if (text) problems.text = text;
  if (categoryId) problems.categoryId = categoryId;
  return problems;
}

export function escapeRegexPattern(query: string): string {
  return query.replace(/[\\^$.|?*+()[\]{}]/g, (character) => `\\${character}`);
}

export function normalizeSearchQuery(raw: string): string {
  return Array.from(removeUnsupportedCharacters(raw).trim()).slice(0, PROMPT_SEARCH_MAX_LENGTH).join("");
}

export function removeUnsupportedCharacters(value: string): string {
  return value.replaceAll(UNSUPPORTED_TEXT_CHARACTER, "");
}

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function pageRange(page: number, pageSize: number): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

export function selectMatchingIds(
  headers: { id: string }[],
  filters: { titleIds?: Set<string>; bodyIds?: Set<string>; tagIds?: Set<string> },
): string[] {
  const searching = filters.titleIds !== undefined || filters.bodyIds !== undefined;
  return headers
    .map(({ id }) => id)
    .filter((id) => {
      const matchesQuery = !searching || Boolean(filters.titleIds?.has(id) || filters.bodyIds?.has(id));
      const matchesTag = !filters.tagIds || filters.tagIds.has(id);
      return matchesQuery && matchesTag;
    });
}

function firstValue(raw: string | string[] | undefined): string {
  return removeUnsupportedCharacters(Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "")).trim();
}

function parsePageNumber(raw: string): number {
  return /^[1-9]\d{0,8}$/.test(raw) ? Number(raw) : 1;
}

export function parsePromptsListParams(raw: {
  q?: string | string[];
  tag?: string | string[];
  category?: string | string[];
  page?: string | string[];
  view?: string | string[];
}): PromptsListParams {
  return {
    query: normalizeSearchQuery(firstValue(raw.q)),
    tag: firstValue(raw.tag),
    category: firstValue(raw.category),
    page: parsePageNumber(firstValue(raw.page)),
    view: firstValue(raw.view) === "table" ? "table" : DEFAULT_PROMPTS_VIEW,
  };
}

export function promptsListHref(params: Partial<PromptsListParams>): string {
  const search = new URLSearchParams();
  if (params.query) search.set("q", params.query);
  if (params.category) search.set("category", params.category);
  if (params.tag) search.set("tag", params.tag);
  if (params.view && params.view !== DEFAULT_PROMPTS_VIEW) search.set("view", params.view);
  if (params.page && params.page > 1) search.set("page", String(params.page));
  const queryString = search.toString();
  return queryString ? `/prompts?${queryString}` : "/prompts";
}
