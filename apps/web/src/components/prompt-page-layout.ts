export const ALL_PROMPTS_BACK_LINK = { href: "/prompts", label: "All prompts" };

export const PROMPT_PAGE_LAYOUT_CLASS = "grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]";

export function promptBackLink(promptId: string) {
  return { href: `/prompts/${promptId}`, label: "Back to prompt" };
}
