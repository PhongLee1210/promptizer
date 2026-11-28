import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { CategorySummary, PackSummary, Prompt, PromptListPage } from "@promptizer/shared";
import { PROMPTS_PAGE_SIZE } from "@promptizer/shared";
import { isPromptId } from "../prompts/prompts.ts";
import type { PromptsListParams } from "../prompts/prompts.ts";
import { findCategory, listPacksWithCounts } from "./categories.ts";
import { findPrompt, listCategories, listPrompts, listTagCounts } from "./prompts.ts";
import { ACCESS_COOKIE } from "./session-cookies.ts";

export interface PromptListForSession {
  page: PromptListPage;
  categories: CategorySummary[];
  tagCounts: { tag: string; count: number }[];
}

export const readSessionAccessToken = cache(async (): Promise<string | undefined> => {
  return (await cookies()).get(ACCESS_COOKIE)?.value;
});

export async function loadPromptOrNotFound(id: string): Promise<Prompt> {
  const accessToken = await readSessionAccessToken();
  if (!accessToken || !isPromptId(id)) {
    notFound();
  }
  const found = await findPrompt(accessToken, id);
  if (found.ok) {
    return found.value;
  }
  if (found.failure.body.code === "not_found") {
    notFound();
  }
  throw new Error("Could not load prompt");
}

export async function loadCategoriesForSession(): Promise<CategorySummary[]> {
  const accessToken = await readSessionAccessToken();
  if (!accessToken) {
    return [];
  }
  const categories = await listCategories(accessToken);
  if (!categories.ok) {
    throw new Error("Could not load categories");
  }
  return categories.value;
}

export async function loadPacksForSession(): Promise<PackSummary[]> {
  const accessToken = await readSessionAccessToken();
  if (!accessToken) {
    return [];
  }
  const packs = await listPacksWithCounts(accessToken);
  if (!packs.ok) {
    throw new Error("Could not load packs");
  }
  return packs.value;
}

export async function loadPackOrNotFound(id: string): Promise<CategorySummary> {
  const accessToken = await readSessionAccessToken();
  if (!accessToken || !isPromptId(id)) {
    notFound();
  }
  const found = await findCategory(accessToken, id);
  if (found.ok) {
    return found.value;
  }
  if (found.failure.body.code === "not_found") {
    notFound();
  }
  throw new Error("Could not load pack");
}

export async function loadPromptListForSession(params: PromptsListParams): Promise<PromptListForSession> {
  const accessToken = await readSessionAccessToken();
  const query = {
    query: params.query,
    categoryId: params.category || undefined,
    tag: params.tag || undefined,
    page: params.page,
    pageSize: PROMPTS_PAGE_SIZE,
  };
  if (!accessToken) {
    return {
      page: { items: [], total: 0, page: params.page, pageSize: PROMPTS_PAGE_SIZE },
      categories: [],
      tagCounts: [],
    };
  }
  const [page, categories, tagCounts] = await Promise.all([
    listPrompts(accessToken, query),
    listCategories(accessToken),
    listTagCounts(accessToken),
  ]);
  if (!page.ok || !categories.ok || !tagCounts.ok) {
    throw new Error("Could not load prompts");
  }
  return { page: page.value, categories: categories.value, tagCounts: tagCounts.value };
}
