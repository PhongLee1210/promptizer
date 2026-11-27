import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type {
  CategorySummary,
  Prompt,
  PromptChanges,
  PromptDraft,
  PromptListPage,
  PromptModel,
} from "@promptizer/shared";
import { escapeRegexPattern, isPromptId, pageRange, selectMatchingIds } from "../prompts/prompts.ts";
import type { AuthenticatedCaller } from "./authenticate.ts";
import { PROMPT_NOT_FOUND, SERVICE_UNAVAILABLE, UNAUTHENTICATED, fail, succeed } from "./outcome.ts";
import type { Outcome } from "./outcome.ts";
import { createUserClient } from "./supabase.ts";
import type { PromptListQuery } from "./validation.ts";

interface PromptRow {
  id: string;
  title: string;
  model: PromptModel | null;
  created_at: string;
  updated_at: string;
  category: CategorySummary | null;
  prompt_tag: { tag: { name: string } | null }[];
  prompt_version: { version_number: number; body: string }[];
}

interface DatabaseError {
  error: PostgrestError | null;
  status?: number;
}

const PROMPT_COLUMNS =
  "id, title, model, created_at, updated_at, category(id, name), prompt_tag(tag(name)), prompt_version(version_number, body)";
const UNAUTHENTICATED_ERROR_CODES = new Set(["PGRST301", "PGRST302", "PGRST303"]);
const NOT_FOUND_ERROR_CODES = new Set(["22P02", "PGRST116"]);
const FOREIGN_KEY_VIOLATION = "23503";
const RANGE_NOT_SATISFIABLE = "PGRST103";
const UNKNOWN_CATEGORY = fail(422, "validation_failed", "Please fix the highlighted fields.", {
  categoryId: "Choose one of your categories.",
});

function failureForDatabaseError({ error, status }: DatabaseError) {
  if (status === 401 || (error && UNAUTHENTICATED_ERROR_CODES.has(error.code))) {
    return UNAUTHENTICATED;
  }
  if (error && NOT_FOUND_ERROR_CODES.has(error.code)) {
    return PROMPT_NOT_FOUND;
  }
  if (error?.code === FOREIGN_KEY_VIOLATION) {
    return UNKNOWN_CATEGORY;
  }
  return SERVICE_UNAVAILABLE;
}

function latestVersion(row: Pick<PromptRow, "prompt_version">) {
  return row.prompt_version.reduce<PromptRow["prompt_version"][number] | undefined>(
    (newest, version) => (!newest || version.version_number > newest.version_number ? version : newest),
    undefined,
  );
}

function tagNames(row: PromptRow): string[] {
  return row.prompt_tag.flatMap(({ tag }) => (tag ? [tag.name] : [])).sort();
}

export function toPrompt(row: PromptRow): Prompt {
  return {
    id: row.id,
    title: row.title,
    text: latestVersion(row)?.body ?? "",
    model: row.model,
    category: row.category ? { id: row.category.id, name: row.category.name } : null,
    tags: tagNames(row),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

async function selectPromptRow(client: SupabaseClient, id: string): Promise<Outcome<PromptRow>> {
  const { data, error, status } = await client.from("prompt").select(PROMPT_COLUMNS).eq("id", id).maybeSingle();
  if (error) {
    return failureForDatabaseError({ error, status });
  }
  return data ? succeed(data as unknown as PromptRow) : PROMPT_NOT_FOUND;
}

export async function findPrompt(accessToken: string, id: string): Promise<Outcome<Prompt>> {
  if (!isPromptId(id)) {
    return PROMPT_NOT_FOUND;
  }
  const row = await selectPromptRow(createUserClient(accessToken), id);
  return row.ok ? succeed(toPrompt(row.value)) : row;
}

export async function createPrompt(caller: AuthenticatedCaller, draft: PromptDraft): Promise<Outcome<Prompt>> {
  const client = createUserClient(caller.accessToken);
  const inserted = await client
    .from("prompt")
    .insert({ user_id: caller.user.id, title: draft.title, category_id: draft.categoryId ?? null })
    .select("id")
    .single();
  if (inserted.error || !inserted.data) {
    return failureForDatabaseError(inserted);
  }
  const promptId = (inserted.data as { id: string }).id;
  const version = await client
    .from("prompt_version")
    .insert({ prompt_id: promptId, version_number: 1, body: draft.text });
  if (version.error) {
    await client.from("prompt").delete().eq("id", promptId);
    return failureForDatabaseError(version);
  }
  const row = await selectPromptRow(client, promptId);
  return row.ok ? succeed(toPrompt(row.value)) : row;
}

async function writePromptText(
  client: SupabaseClient,
  id: string,
  latestVersionNumber: number | undefined,
  text: string,
) {
  if (latestVersionNumber === undefined) {
    const inserted = await client.from("prompt_version").insert({ prompt_id: id, version_number: 1, body: text });
    return inserted.error ? failureForDatabaseError(inserted) : succeed(null);
  }
  const updated = await client
    .from("prompt_version")
    .update({ body: text })
    .eq("prompt_id", id)
    .eq("version_number", latestVersionNumber)
    .select("id");
  if (updated.error) {
    return failureForDatabaseError(updated);
  }
  return updated.data.length > 0 ? succeed(null) : PROMPT_NOT_FOUND;
}

export async function updatePrompt(accessToken: string, id: string, changes: PromptChanges): Promise<Outcome<Prompt>> {
  if (!isPromptId(id)) {
    return PROMPT_NOT_FOUND;
  }
  const client = createUserClient(accessToken);
  const current = await client.from("prompt").select("id, prompt_version(version_number)").eq("id", id).maybeSingle();
  if (current.error) {
    return failureForDatabaseError(current);
  }
  if (!current.data) {
    return PROMPT_NOT_FOUND;
  }
  const touched = await client.from("prompt").update(promptRowChanges(changes)).eq("id", id).select("id").maybeSingle();
  if (touched.error) {
    return failureForDatabaseError(touched);
  }
  if (!touched.data) {
    return PROMPT_NOT_FOUND;
  }
  if (changes.text !== undefined) {
    const versions = (current.data as { prompt_version: { version_number: number }[] }).prompt_version;
    const latestVersionNumber = versions.reduce<number | undefined>(
      (highest, { version_number }) => (highest === undefined || version_number > highest ? version_number : highest),
      undefined,
    );
    const written = await writePromptText(client, id, latestVersionNumber, changes.text);
    if (!written.ok) {
      return written;
    }
  }
  return findPrompt(accessToken, id);
}

function promptRowChanges(changes: PromptChanges): {
  title?: string;
  category_id?: string | null;
  updated_at?: string;
} {
  const rowChanges: { title?: string; category_id?: string | null; updated_at?: string } = {};
  if (changes.title !== undefined) {
    rowChanges.title = changes.title;
  }
  if (changes.categoryId !== undefined) {
    rowChanges.category_id = changes.categoryId;
  }
  return Object.keys(rowChanges).length > 0 ? rowChanges : { updated_at: new Date().toISOString() };
}

export async function deletePrompt(accessToken: string, id: string): Promise<Outcome<null>> {
  if (!isPromptId(id)) {
    return PROMPT_NOT_FOUND;
  }
  const deleted = await createUserClient(accessToken).from("prompt").delete().eq("id", id).select("id");
  if (deleted.error) {
    return failureForDatabaseError(deleted);
  }
  return deleted.data.length > 0 ? succeed(null) : PROMPT_NOT_FOUND;
}

interface RangeableRequest {
  range(from: number, to: number): PromiseLike<{ data: unknown; error: PostgrestError | null; status: number }>;
}

export const ROW_BATCH_SIZE = 1000;

export async function selectAllRows<Row>(buildRequest: () => RangeableRequest): Promise<Outcome<Row[]>> {
  const rows: Row[] = [];
  for (;;) {
    const { data, error, status } = await buildRequest().range(rows.length, rows.length + ROW_BATCH_SIZE - 1);
    if (error?.code === RANGE_NOT_SATISFIABLE) {
      return succeed(rows);
    }
    if (error) {
      return failureForDatabaseError({ error, status });
    }
    const batch = (data ?? []) as Row[];
    if (batch.length === 0) {
      return succeed(rows);
    }
    rows.push(...batch);
  }
}

function emptyPage(query: PromptListQuery, total: number): PromptListPage {
  return { items: [], total, page: query.page, pageSize: query.pageSize };
}

async function listUnfilteredByText(client: SupabaseClient, query: PromptListQuery): Promise<Outcome<PromptListPage>> {
  const { from, to } = pageRange(query.page, query.pageSize);
  let request = client.from("prompt").select(PROMPT_COLUMNS, { count: "exact" });
  if (query.categoryId) {
    request = request.eq("category_id", query.categoryId);
  }
  const listed = await request
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to)
    .overrideTypes<PromptRow[], { merge: false }>();
  if (listed.error?.code === RANGE_NOT_SATISFIABLE) {
    let countRequest = client.from("prompt").select("id", { count: "exact", head: true });
    if (query.categoryId) {
      countRequest = countRequest.eq("category_id", query.categoryId);
    }
    const counted = await countRequest;
    return counted.error ? failureForDatabaseError(counted) : succeed(emptyPage(query, counted.count ?? 0));
  }
  if (listed.error) {
    return failureForDatabaseError(listed);
  }
  return succeed({
    items: (listed.data as PromptRow[]).map(toPrompt),
    total: listed.count ?? listed.data.length,
    page: query.page,
    pageSize: query.pageSize,
  });
}

async function selectIds(buildRequest: () => RangeableRequest, column: string): Promise<Outcome<Set<string>>> {
  const selected = await selectAllRows<Record<string, string>>(buildRequest);
  return selected.ok ? succeed(new Set(selected.value.map((row) => row[column]))) : selected;
}

async function listFilteredByText(client: SupabaseClient, query: PromptListQuery): Promise<Outcome<PromptListPage>> {
  const pattern = escapeRegexPattern(query.query);
  const [headers, titleIds, bodyIds, tagIds] = await Promise.all([
    selectAllRows<{ id: string }>(() => {
      const request = client.from("prompt").select("id");
      return (query.categoryId ? request.eq("category_id", query.categoryId) : request)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });
    }),
    query.query
      ? selectIds(() => client.from("prompt").select("id").regexIMatch("title", pattern).order("id"), "id")
      : undefined,
    query.query
      ? selectIds(
          () =>
            client.from("prompt_latest_version").select("prompt_id").regexIMatch("body", pattern).order("prompt_id"),
          "prompt_id",
        )
      : undefined,
    query.tag
      ? selectIds(
          () =>
            client
              .from("prompt_tag")
              .select("prompt_id, tag!inner(name)")
              .eq("tag.name", query.tag as string)
              .order("prompt_id"),
          "prompt_id",
        )
      : undefined,
  ]);
  if (!headers.ok) {
    return headers;
  }
  for (const ids of [titleIds, bodyIds, tagIds]) {
    if (ids && !ids.ok) {
      return ids;
    }
  }
  const matchingIds = selectMatchingIds(headers.value, {
    titleIds: titleIds?.ok ? titleIds.value : undefined,
    bodyIds: bodyIds?.ok ? bodyIds.value : undefined,
    tagIds: tagIds?.ok ? tagIds.value : undefined,
  });
  const { from, to } = pageRange(query.page, query.pageSize);
  const pageIds = matchingIds.slice(from, to + 1);
  if (pageIds.length === 0) {
    return succeed(emptyPage(query, matchingIds.length));
  }
  const rows = await client
    .from("prompt")
    .select(PROMPT_COLUMNS)
    .in("id", pageIds)
    .overrideTypes<PromptRow[], { merge: false }>();
  if (rows.error) {
    return failureForDatabaseError(rows);
  }
  const rowsById = new Map((rows.data as PromptRow[]).map((row) => [row.id, row]));
  return succeed({
    items: pageIds.flatMap((id) => {
      const row = rowsById.get(id);
      return row ? [toPrompt(row)] : [];
    }),
    total: matchingIds.length,
    page: query.page,
    pageSize: query.pageSize,
  });
}

export async function listPrompts(accessToken: string, query: PromptListQuery): Promise<Outcome<PromptListPage>> {
  if (query.categoryId && !isPromptId(query.categoryId)) {
    return succeed(emptyPage(query, 0));
  }
  const client = createUserClient(accessToken);
  return query.query || query.tag ? listFilteredByText(client, query) : listUnfilteredByText(client, query);
}

export async function listCategories(accessToken: string): Promise<Outcome<CategorySummary[]>> {
  const listed = await createUserClient(accessToken).from("category").select("id, name").order("name");
  return listed.error ? failureForDatabaseError(listed) : succeed(listed.data as CategorySummary[]);
}

export async function listTagCounts(accessToken: string): Promise<Outcome<{ tag: string; count: number }[]>> {
  const client = createUserClient(accessToken);
  const listed = await selectAllRows<{ tag: { name: string } | null }>(() =>
    client.from("prompt_tag").select("prompt_id, tag_id, tag(name)").order("prompt_id").order("tag_id"),
  );
  if (!listed.ok) {
    return listed;
  }
  const counts = new Map<string, number>();
  for (const { tag } of listed.value) {
    if (tag) {
      counts.set(tag.name, (counts.get(tag.name) ?? 0) + 1);
    }
  }
  return succeed(
    [...counts.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => a.tag.localeCompare(b.tag)),
  );
}
