import type { CategoryChanges, CategoryDraft, CategorySummary, PackSummary } from "@promptizer/shared";
import { isPromptId } from "../prompts/prompts.ts";
import type { AuthenticatedCaller } from "./authenticate.ts";
import { CATEGORY_NOT_FOUND, SERVICE_UNAVAILABLE, UNAUTHENTICATED, fail, succeed } from "./outcome.ts";
import type { Outcome } from "./outcome.ts";
import { selectAllRows } from "./prompts.ts";
import { createUserClient } from "./supabase.ts";

interface DatabaseError {
  error: { code?: string } | null;
  status?: number;
}

const UNAUTHENTICATED_ERROR_CODES = new Set(["PGRST301", "PGRST302", "PGRST303"]);
const NOT_FOUND_ERROR_CODES = new Set(["22P02", "PGRST116"]);
const UNIQUE_VIOLATION = "23505";
const NAME_TAKEN = fail(422, "validation_failed", "Please fix the highlighted fields.", {
  name: "You already have a pack with this name.",
});

function failureForDatabaseError({ error, status }: DatabaseError) {
  if (status === 401 || (error?.code && UNAUTHENTICATED_ERROR_CODES.has(error.code))) {
    return UNAUTHENTICATED;
  }
  if (error?.code && NOT_FOUND_ERROR_CODES.has(error.code)) {
    return CATEGORY_NOT_FOUND;
  }
  if (error?.code === UNIQUE_VIOLATION) {
    return NAME_TAKEN;
  }
  return SERVICE_UNAVAILABLE;
}

export async function createCategory(
  caller: AuthenticatedCaller,
  draft: CategoryDraft,
): Promise<Outcome<CategorySummary>> {
  const inserted = await createUserClient(caller.accessToken)
    .from("category")
    .insert({ user_id: caller.user.id, name: draft.name })
    .select("id, name")
    .single();
  if (inserted.error || !inserted.data) {
    return failureForDatabaseError(inserted);
  }
  return succeed(inserted.data as CategorySummary);
}

export async function renameCategory(
  accessToken: string,
  id: string,
  changes: CategoryChanges,
): Promise<Outcome<CategorySummary>> {
  if (!isPromptId(id)) {
    return CATEGORY_NOT_FOUND;
  }
  const updated = await createUserClient(accessToken)
    .from("category")
    .update({ name: changes.name })
    .eq("id", id)
    .select("id, name")
    .maybeSingle();
  if (updated.error) {
    return failureForDatabaseError(updated);
  }
  return updated.data ? succeed(updated.data as CategorySummary) : CATEGORY_NOT_FOUND;
}

export async function deleteCategory(accessToken: string, id: string): Promise<Outcome<null>> {
  if (!isPromptId(id)) {
    return CATEGORY_NOT_FOUND;
  }
  const deleted = await createUserClient(accessToken).from("category").delete().eq("id", id).select("id");
  if (deleted.error) {
    return failureForDatabaseError(deleted);
  }
  return deleted.data.length > 0 ? succeed(null) : CATEGORY_NOT_FOUND;
}

export async function findCategory(accessToken: string, id: string): Promise<Outcome<CategorySummary>> {
  if (!isPromptId(id)) {
    return CATEGORY_NOT_FOUND;
  }
  const found = await createUserClient(accessToken).from("category").select("id, name").eq("id", id).maybeSingle();
  if (found.error) {
    return failureForDatabaseError(found);
  }
  return found.data ? succeed(found.data as CategorySummary) : CATEGORY_NOT_FOUND;
}

export async function listPacksWithCounts(accessToken: string): Promise<Outcome<PackSummary[]>> {
  const client = createUserClient(accessToken);
  const categories = await client.from("category").select("id, name").order("name");
  if (categories.error) {
    return failureForDatabaseError(categories);
  }
  const assignments = await selectAllRows<{ category_id: string | null }>(() =>
    client.from("prompt").select("category_id").not("category_id", "is", null),
  );
  if (!assignments.ok) {
    return assignments;
  }
  const counts = new Map<string, number>();
  for (const { category_id } of assignments.value) {
    if (category_id) {
      counts.set(category_id, (counts.get(category_id) ?? 0) + 1);
    }
  }
  return succeed(
    (categories.data as CategorySummary[]).map((category) => ({
      ...category,
      promptCount: counts.get(category.id) ?? 0,
    })),
  );
}
