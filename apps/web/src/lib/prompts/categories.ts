import { CATEGORY_NAME_MAX_LENGTH, countCharacters } from "@promptizer/shared";
import type { CategoryFieldErrors } from "@promptizer/shared";

export function normalizeCategoryName(name: string): string {
  return name.trim();
}

export function categoryDraftProblems(draft: { name?: unknown }): CategoryFieldErrors {
  const problems: CategoryFieldErrors = {};
  if (typeof draft.name !== "string" || normalizeCategoryName(draft.name) === "") {
    problems.name = "Enter a name.";
  } else if (countCharacters(normalizeCategoryName(draft.name)) > CATEGORY_NAME_MAX_LENGTH) {
    problems.name = `Use at most ${CATEGORY_NAME_MAX_LENGTH} characters.`;
  }
  return problems;
}
