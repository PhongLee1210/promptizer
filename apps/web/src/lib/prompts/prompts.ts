export type PromptSource = "ChatGPT" | "Claude" | "Gemini";

export interface PromptSummary {
  id: string;
  title: string;
  body: string;
  source: PromptSource | null;
  category: string | null;
  tags: string[];
  updatedAt: Date;
}

export type PromptsDisplayMode = "cards" | "table";

export interface PromptsListParams {
  query: string;
  tag: string;
  view: PromptsDisplayMode;
}

export const DEFAULT_PROMPTS_VIEW: PromptsDisplayMode = "cards";

function firstValue(raw: string | string[] | undefined): string {
  return (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
}

export function parsePromptsListParams(raw: {
  q?: string | string[];
  tag?: string | string[];
  view?: string | string[];
}): PromptsListParams {
  return {
    query: firstValue(raw.q),
    tag: firstValue(raw.tag),
    view: firstValue(raw.view) === "table" ? "table" : DEFAULT_PROMPTS_VIEW,
  };
}

export function promptsListHref(params: Partial<PromptsListParams>): string {
  const search = new URLSearchParams();
  if (params.query) search.set("q", params.query);
  if (params.tag) search.set("tag", params.tag);
  if (params.view && params.view !== DEFAULT_PROMPTS_VIEW) search.set("view", params.view);
  const queryString = search.toString();
  return queryString ? `/prompts?${queryString}` : "/prompts";
}

export function filterPrompts(prompts: PromptSummary[], { query, tag }: Pick<PromptsListParams, "query" | "tag">) {
  const needle = query.toLowerCase();
  return prompts.filter((prompt) => {
    const matchesTag = !tag || prompt.tags.includes(tag);
    const matchesQuery =
      !needle ||
      [prompt.title, prompt.body, prompt.category ?? "", ...prompt.tags].some((text) =>
        text.toLowerCase().includes(needle),
      );
    return matchesTag && matchesQuery;
  });
}

export function countTags(prompts: PromptSummary[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const prompt of prompts) {
    for (const tag of prompt.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => a.tag.localeCompare(b.tag));
}
