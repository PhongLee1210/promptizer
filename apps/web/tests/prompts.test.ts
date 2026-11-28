import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { PROMPT_TEXT_MAX_LENGTH } from "@promptizer/shared";
import type { ApiErrorBody, AuthSession, CategorySummary, Prompt, PromptListPage } from "@promptizer/shared";
import { DELETE as deleteCategoryRoute, PATCH as renameCategoryRoute } from "../src/app/api/categories/[id]/route.ts";
import { POST as createCategoryRoute } from "../src/app/api/categories/route.ts";
import {
  DELETE as deletePromptRoute,
  GET as getPrompt,
  PATCH as patchPrompt,
} from "../src/app/api/prompts/[id]/route.ts";
import { GET as listPromptsRoute, POST as createPromptRoute } from "../src/app/api/prompts/route.ts";
import { POST as register } from "../src/app/api/auth/register/route.ts";
import {
  escapeRegexPattern,
  isPromptId,
  normalizeSearchQuery,
  pageCount,
  pageRange,
  parsePromptsListParams,
  promptsListHref,
  selectMatchingIds,
} from "../src/lib/prompts/prompts.ts";
import { ROW_BATCH_SIZE, selectAllRows } from "../src/lib/server/prompts.ts";
import { createAdminClient, isSupabaseConfigured } from "../src/lib/server/supabase.ts";

const ORIGIN = "http://localhost";
const PASSWORD = "correct-horse-battery";
const MISSING_ID = "00000000-0000-4000-8000-000000000000";
const NOT_FOUND_MESSAGE = "This prompt doesn't exist or was deleted.";

test("prompt ids must be UUIDs", () => {
  assert.equal(isPromptId("3f2c9a10-1b2c-4d5e-8f90-123456789abc"), true);
  assert.equal(isPromptId("3F2C9A10-1B2C-4D5E-8F90-123456789ABC"), true);
  for (const value of ["", "new", "123", "3f2c9a10-1b2c-4d5e-8f90-123456789abc/edit", "../etc"]) {
    assert.equal(isPromptId(value), false, value);
  }
});

test("search text escapes every regex metacharacter so it matches literally", () => {
  assert.equal(escapeRegexPattern("**a.b"), "\\*\\*a\\.b");
  assert.equal(escapeRegexPattern("50%_off"), "50%_off");
  assert.equal(escapeRegexPattern("^(x|y)+[z]{2}?$\\"), "\\^\\(x\\|y\\)\\+\\[z\\]\\{2\\}\\?\\$\\\\");
});

test("search queries drop NUL characters, trim and cap their length", () => {
  assert.equal(normalizeSearchQuery("  a\u0000b  "), "ab");
  assert.equal(normalizeSearchQuery("\u0000"), "");
  assert.equal(Array.from(normalizeSearchQuery("😀".repeat(500))).length, 200);
  assert.deepEqual(
    { ...parsePromptsListParams({ q: "x\u0000y", tag: "t\u0000" }) },
    { ...parsePromptsListParams({ q: "xy", tag: "t" }) },
  );
});

test("matching ids keep header order, OR title and body matches and AND the tag", () => {
  const headers = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  assert.deepEqual(selectMatchingIds(headers, { titleIds: new Set(["c"]), bodyIds: new Set(["a", "d"]) }), [
    "a",
    "c",
    "d",
  ]);
  assert.deepEqual(
    selectMatchingIds(headers, { titleIds: new Set(["c"]), bodyIds: new Set(["a"]), tagIds: new Set(["a", "b"]) }),
    ["a"],
  );
  assert.deepEqual(selectMatchingIds(headers, { tagIds: new Set(["d", "b"]) }), ["b", "d"]);
});

test("id queries read every batch instead of stopping at the server row cap", async () => {
  const totalRows = ROW_BATCH_SIZE * 2 + 5;
  const requestedRanges: [number, number][] = [];
  const result = await selectAllRows<{ id: number }>(() => ({
    range(from: number, to: number) {
      requestedRanges.push([from, to]);
      const data = Array.from({ length: Math.max(0, Math.min(to, totalRows - 1) - from + 1) }, (_, index) => ({
        id: from + index,
      }));
      return Promise.resolve({ data, error: null, status: 200 });
    },
  }));
  assert.equal(result.ok && result.value.length, totalRows);
  assert.equal(requestedRanges.length, 4);
  assert.deepEqual(requestedRanges[1], [ROW_BATCH_SIZE, ROW_BATCH_SIZE * 2 - 1]);
});

test("pagination math", () => {
  assert.equal(pageCount(0, 12), 1);
  assert.equal(pageCount(13, 12), 2);
  assert.deepEqual(pageRange(1, 12), { from: 0, to: 11 });
  assert.deepEqual(pageRange(3, 12), { from: 24, to: 35 });
});

test("list URL params round-trip and drop defaults", () => {
  const params = parsePromptsListParams({ q: " plan ", category: "c1", tag: "t", page: "3", view: "table" });
  assert.deepEqual(params, { query: "plan", tag: "t", category: "c1", page: 3, view: "table" });
  assert.equal(promptsListHref(params), "/prompts?q=plan&category=c1&tag=t&view=table&page=3");
  assert.equal(promptsListHref({ ...params, page: 1, view: "cards", query: "", tag: "", category: "" }), "/prompts");
  for (const page of ["0", "-2", "abc", "", "1e3"]) {
    assert.equal(parsePromptsListParams({ page }).page, 1, page);
  }
});

describe(
  "prompts API against Supabase",
  { skip: !isSupabaseConfigured() && "Supabase environment not configured" },
  () => {
    const createdUserIds: string[] = [];
    let owner: AuthSession;
    let stranger: AuthSession;

    function request(method: string, path: string, session?: AuthSession, body?: unknown): Request {
      const headers: Record<string, string> = {};
      if (session) headers.Authorization = `Bearer ${session.accessToken}`;
      if (body !== undefined) headers["Content-Type"] = "application/json";
      return new Request(`${ORIGIN}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    }

    function routeContext(id: string) {
      return { params: Promise.resolve({ id }) };
    }

    async function registerAccount(): Promise<AuthSession> {
      const email = `promptizer-test-${crypto.randomUUID()}@example.com`;
      const response = await register(
        request("POST", "/api/auth/register", undefined, { email, password: PASSWORD, name: "Ada" }),
      );
      assert.equal(response.status, 201);
      const session = (await response.json()) as AuthSession;
      createdUserIds.push(session.user.id);
      return session;
    }

    async function createPrompt(session: AuthSession, draft: Record<string, unknown>): Promise<Prompt> {
      const response = await createPromptRoute(request("POST", "/api/prompts", session, draft));
      assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));
      return (await response.json()) as Prompt;
    }

    async function listPage(session: AuthSession, search = ""): Promise<PromptListPage> {
      const response = await listPromptsRoute(request("GET", `/api/prompts${search}`, session));
      assert.equal(response.status, 200);
      return (await response.json()) as PromptListPage;
    }

    async function createCategory(session: AuthSession, name: string): Promise<string> {
      const { data, error } = await createAdminClient()
        .from("category")
        .insert({ user_id: session.user.id, name })
        .select("id")
        .single();
      assert.equal(error, null);
      return (data as { id: string }).id;
    }

    before(async () => {
      owner = await registerAccount();
      stranger = await registerAccount();
    });

    after(async () => {
      const admin = createAdminClient();
      await Promise.all(createdUserIds.map((id) => admin.auth.admin.deleteUser(id)));
    });

    test("create returns the owned prompt with its location", async () => {
      const response = await createPromptRoute(
        request("POST", "/api/prompts", owner, { title: "  Weekly plan ", text: "Plan the week." }),
      );
      assert.equal(response.status, 201);
      const prompt = (await response.json()) as Prompt;
      assert.equal(response.headers.get("Location"), `/api/prompts/${prompt.id}`);
      assert.equal(prompt.title, "Weekly plan");
      assert.equal(prompt.text, "Plan the week.");
      assert.equal(prompt.category, null);
      assert.ok(isPromptId(prompt.id));
    });

    test("create reports field-level validation and rejects anonymous callers", async () => {
      const missingTitle = await createPromptRoute(request("POST", "/api/prompts", owner, { text: "body" }));
      assert.equal(missingTitle.status, 422);
      assert.deepEqual(((await missingTitle.json()) as ApiErrorBody).fields, { title: "Enter a title." });
      const oversized = await createPromptRoute(
        request("POST", "/api/prompts", owner, { title: "Big", text: "a".repeat(PROMPT_TEXT_MAX_LENGTH + 1) }),
      );
      assert.equal(oversized.status, 422);
      assert.ok(((await oversized.json()) as ApiErrorBody).fields?.text);
      const anonymous = await createPromptRoute(request("POST", "/api/prompts", undefined, { title: "t", text: "x" }));
      assert.equal(anonymous.status, 401);
      assert.equal(((await anonymous.json()) as ApiErrorBody).code, "unauthenticated");
    });

    test("create accepts the dashboard session cookie", async () => {
      const response = await createPromptRoute(
        new Request(`${ORIGIN}/api/prompts`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: `promptizer_access=${owner.accessToken}` },
          body: JSON.stringify({ title: "From cookie", text: "x" }),
        }),
      );
      assert.equal(response.status, 201);
    });

    test("text round-trips exactly, including whitespace, line endings and hostile markup", async () => {
      const text = `  leading\r\n\ttabs\n\n<script>alert(1)</script> **md** 😀 trailing  \r\n`;
      const created = await createPrompt(owner, { title: "Round trip", text });
      const fetched = await getPrompt(request("GET", `/api/prompts/${created.id}`, owner), routeContext(created.id));
      assert.equal(fetched.status, 200);
      assert.equal(((await fetched.json()) as Prompt).text, text);
      const longest = "😀".repeat(PROMPT_TEXT_MAX_LENGTH);
      const big = await createPrompt(owner, { title: "Longest", text: longest });
      assert.equal(big.text, longest);
    });

    test("missing and malformed ids are not found", async () => {
      for (const id of [MISSING_ID, "not-a-uuid"]) {
        const response = await getPrompt(request("GET", `/api/prompts/${id}`, owner), routeContext(id));
        assert.equal(response.status, 404, id);
        assert.deepEqual(await response.json(), { code: "not_found", message: NOT_FOUND_MESSAGE });
      }
    });

    test("another account cannot read, change or delete a prompt and sees not-found", async () => {
      const created = await createPrompt(owner, { title: "Private", text: "Only mine" });
      const attempts = [
        await getPrompt(request("GET", `/api/prompts/${created.id}`, stranger), routeContext(created.id)),
        await patchPrompt(
          request("PATCH", `/api/prompts/${created.id}`, stranger, { text: "hijacked" }),
          routeContext(created.id),
        ),
        await deletePromptRoute(request("DELETE", `/api/prompts/${created.id}`, stranger), routeContext(created.id)),
      ];
      for (const response of attempts) {
        assert.equal(response.status, 404);
        assert.deepEqual(await response.json(), { code: "not_found", message: NOT_FOUND_MESSAGE });
      }
      const strangerList = await listPage(stranger);
      assert.equal(
        strangerList.items.some((prompt) => prompt.id === created.id),
        false,
      );
      const stillThere = await getPrompt(request("GET", `/api/prompts/${created.id}`, owner), routeContext(created.id));
      assert.equal(((await stillThere.json()) as Prompt).text, "Only mine");
    });

    test("a prompt cannot be filed under another account's category", async () => {
      const ownerCategory = await createCategory(owner, `Owner ${crypto.randomUUID()}`);
      const response = await createPromptRoute(
        request("POST", "/api/prompts", stranger, { title: "t", text: "x", categoryId: ownerCategory }),
      );
      assert.equal(response.status, 422);
      assert.ok(((await response.json()) as ApiErrorBody).fields?.categoryId);
    });

    test("list is paginated newest first, searches title and text and filters by category", async () => {
      const lister = await registerAccount();
      const category = await createCategory(lister, "Research");
      const created: Prompt[] = [];
      for (let index = 0; index < 14; index += 1) {
        created.push(
          await createPrompt(lister, {
            title: index === 3 ? "Quarterly ZEBRA review" : `Prompt ${index}`,
            text:
              index === 5
                ? "Body mentions zebra stripes"
                : index === 7
                  ? "100% literal_match **bold**"
                  : `Body ${index}`,
            categoryId: index < 2 ? category : undefined,
          }),
        );
      }
      const firstPage = await listPage(lister);
      assert.equal(firstPage.total, 14);
      assert.equal(firstPage.items.length, 12);
      assert.deepEqual(
        firstPage.items.map((prompt) => prompt.id),
        created
          .slice(2)
          .reverse()
          .map((prompt) => prompt.id),
      );
      const secondPage = await listPage(lister, "?page=2");
      assert.equal(secondPage.items.length, 2);
      const beyond = await listPage(lister, "?page=99");
      assert.deepEqual({ items: beyond.items, total: beyond.total }, { items: [], total: 14 });

      const zebra = await listPage(lister, "?q=zebra");
      assert.deepEqual(zebra.items.map((prompt) => prompt.id).sort(), [created[3].id, created[5].id].sort());
      assert.equal(zebra.total, 2);
      const literal = await listPage(lister, `?q=${encodeURIComponent("0% literal_")}`);
      assert.deepEqual(
        literal.items.map((prompt) => prompt.id),
        [created[7].id],
      );
      const underscoreOnly = await listPage(lister, "?q=_");
      assert.deepEqual(
        underscoreOnly.items.map((prompt) => prompt.id),
        [created[7].id],
      );

      const asterisks = await listPage(lister, `?q=${encodeURIComponent("**")}`);
      assert.deepEqual(
        asterisks.items.map((prompt) => prompt.id),
        [created[7].id],
      );
      const nulQuery = await listPromptsRoute(request("GET", "/api/prompts?q=%00", lister));
      assert.equal(nulQuery.status, 200);
      assert.equal(((await nulQuery.json()) as PromptListPage).total, 14);

      const filtered = await listPage(lister, `?category=${category}`);
      assert.equal(filtered.total, 2);
      assert.ok(filtered.items.every((prompt) => prompt.category?.id === category));
      const filteredSearch = await listPage(lister, `?category=${category}&q=zebra`);
      assert.equal(filteredSearch.total, 0);
      const foreignCategory = await listPage(stranger, `?category=${category}`);
      assert.equal(foreignCategory.total, 0);
      const invalidCategory = await listPage(lister, "?category=nope");
      assert.equal(invalidCategory.total, 0);
      const badPage = await listPromptsRoute(request("GET", "/api/prompts?page=0", lister));
      assert.equal(badPage.status, 422);
    });

    test("update changes only the given fields in place and returns the saved state", async () => {
      const created = await createPrompt(owner, { title: "Before", text: "Original text" });
      const titleOnly = await patchPrompt(
        request("PATCH", `/api/prompts/${created.id}`, owner, { title: " After " }),
        routeContext(created.id),
      );
      assert.equal(titleOnly.status, 200);
      const afterTitle = (await titleOnly.json()) as Prompt;
      assert.deepEqual({ title: afterTitle.title, text: afterTitle.text }, { title: "After", text: "Original text" });

      const textOnly = await patchPrompt(
        request("PATCH", `/api/prompts/${created.id}`, owner, { text: "Edited\r\ntext " }),
        routeContext(created.id),
      );
      const afterText = (await textOnly.json()) as Prompt;
      assert.deepEqual({ title: afterText.title, text: afterText.text }, { title: "After", text: "Edited\r\ntext " });
      assert.ok(afterText.updatedAt >= afterTitle.updatedAt);
      const fetched = await getPrompt(request("GET", `/api/prompts/${created.id}`, owner), routeContext(created.id));
      assert.deepEqual(await fetched.json(), afterText);

      const { count } = await createAdminClient()
        .from("prompt_version")
        .select("id", { count: "exact", head: true })
        .eq("prompt_id", created.id);
      assert.equal(count, 1);

      const oversized = await patchPrompt(
        request("PATCH", `/api/prompts/${created.id}`, owner, { text: "a".repeat(PROMPT_TEXT_MAX_LENGTH + 1) }),
        routeContext(created.id),
      );
      assert.equal(oversized.status, 422);
      const anonymous = await patchPrompt(
        request("PATCH", `/api/prompts/${created.id}`, undefined, { text: "x" }),
        routeContext(created.id),
      );
      assert.equal(anonymous.status, 401);
      const missing = await patchPrompt(
        request("PATCH", `/api/prompts/${MISSING_ID}`, owner, { text: "x" }),
        routeContext(MISSING_ID),
      );
      assert.equal(missing.status, 404);
    });

    test("an update rejected for its category leaves the text unchanged", async () => {
      const created = await createPrompt(owner, { title: "Atomic", text: "Original text" });
      const strangerCategory = await createCategory(stranger, `Stranger ${crypto.randomUUID()}`);
      const rejected = await patchPrompt(
        request("PATCH", `/api/prompts/${created.id}`, owner, {
          text: "Should not land",
          categoryId: strangerCategory,
        }),
        routeContext(created.id),
      );
      assert.equal(rejected.status, 422);
      assert.ok(((await rejected.json()) as ApiErrorBody).fields?.categoryId);
      const fetched = await getPrompt(request("GET", `/api/prompts/${created.id}`, owner), routeContext(created.id));
      assert.equal(((await fetched.json()) as Prompt).text, "Original text");
    });

    test("a text-only update keeps a title changed after the editor loaded", async () => {
      const created = await createPrompt(owner, { title: "Loaded title", text: "Original text" });
      const renamed = await patchPrompt(
        request("PATCH", `/api/prompts/${created.id}`, owner, { title: "Renamed elsewhere" }),
        routeContext(created.id),
      );
      assert.equal(renamed.status, 200);
      const textOnly = await patchPrompt(
        request("PATCH", `/api/prompts/${created.id}`, owner, { text: "Edited text" }),
        routeContext(created.id),
      );
      const saved = (await textOnly.json()) as Prompt;
      assert.deepEqual({ title: saved.title, text: saved.text }, { title: "Renamed elsewhere", text: "Edited text" });
      assert.ok(saved.updatedAt > created.updatedAt);
    });

    test("delete removes the prompt everywhere but keeps its category", async () => {
      const deleter = await registerAccount();
      const category = await createCategory(deleter, "Keep me");
      const created = await createPrompt(deleter, { title: "Doomed", text: "bye", categoryId: category });
      const admin = createAdminClient();
      const { data: tag } = await admin
        .from("tag")
        .insert({ user_id: deleter.user.id, name: "temp" })
        .select("id")
        .single();
      await admin
        .from("prompt_tag")
        .insert({ prompt_id: created.id, tag_id: (tag as { id: string }).id, user_id: deleter.user.id });
      assert.equal((await listPage(deleter)).total, 1);

      const anonymous = await deletePromptRoute(
        request("DELETE", `/api/prompts/${created.id}`),
        routeContext(created.id),
      );
      assert.equal(anonymous.status, 401);
      const deleted = await deletePromptRoute(
        request("DELETE", `/api/prompts/${created.id}`, deleter),
        routeContext(created.id),
      );
      assert.equal(deleted.status, 204);
      const again = await deletePromptRoute(
        request("DELETE", `/api/prompts/${created.id}`, deleter),
        routeContext(created.id),
      );
      assert.equal(again.status, 404);
      const fetched = await getPrompt(request("GET", `/api/prompts/${created.id}`, deleter), routeContext(created.id));
      assert.equal(fetched.status, 404);
      assert.equal((await listPage(deleter)).total, 0);
      const { count: tagLinks } = await admin
        .from("prompt_tag")
        .select("prompt_id", { count: "exact", head: true })
        .eq("prompt_id", created.id);
      assert.equal(tagLinks, 0);
      const { data: keptCategory } = await admin.from("category").select("id").eq("id", category).maybeSingle();
      assert.ok(keptCategory);
    });

    test("create pack returns the owned pack with a trimmed name and its location", async () => {
      const response = await createCategoryRoute(request("POST", "/api/categories", owner, { name: "  Research  " }));
      assert.equal(response.status, 201);
      const category = (await response.json()) as CategorySummary;
      assert.equal(category.name, "Research");
      assert.equal(response.headers.get("Location"), `/api/categories/${category.id}`);
    });

    test("create pack reports a friendly error for a missing or empty name and rejects anonymous callers", async () => {
      const missing = await createCategoryRoute(request("POST", "/api/categories", owner, {}));
      assert.equal(missing.status, 422);
      assert.deepEqual(((await missing.json()) as ApiErrorBody).fields, { name: "Enter a name." });
      const blank = await createCategoryRoute(request("POST", "/api/categories", owner, { name: "   " }));
      assert.equal(blank.status, 422);
      assert.deepEqual(((await blank.json()) as ApiErrorBody).fields, { name: "Enter a name." });
      const anonymous = await createCategoryRoute(request("POST", "/api/categories", undefined, { name: "x" }));
      assert.equal(anonymous.status, 401);
      assert.equal(((await anonymous.json()) as ApiErrorBody).code, "unauthenticated");
    });

    test("a second pack with the same name is rejected as a friendly field error, scoped per owner", async () => {
      const namer = await registerAccount();
      const name = `Duplicate ${crypto.randomUUID()}`;
      const first = await createCategoryRoute(request("POST", "/api/categories", namer, { name }));
      assert.equal(first.status, 201);
      const second = await createCategoryRoute(request("POST", "/api/categories", namer, { name }));
      assert.equal(second.status, 422);
      assert.deepEqual(((await second.json()) as ApiErrorBody).fields, {
        name: "You already have a pack with this name.",
      });
      const elsewhere = await createCategoryRoute(request("POST", "/api/categories", stranger, { name }));
      assert.equal(elsewhere.status, 201);
    });

    test("rename updates the pack; another account cannot rename or delete it and sees not-found", async () => {
      const category = await createCategory(owner, `Rename me ${crypto.randomUUID()}`);
      const foreignRename = await renameCategoryRoute(
        request("PATCH", `/api/categories/${category}`, stranger, { name: "Hijacked" }),
        routeContext(category),
      );
      assert.equal(foreignRename.status, 404);
      const foreignDelete = await deleteCategoryRoute(
        request("DELETE", `/api/categories/${category}`, stranger),
        routeContext(category),
      );
      assert.equal(foreignDelete.status, 404);
      const renamed = await renameCategoryRoute(
        request("PATCH", `/api/categories/${category}`, owner, { name: "  Renamed  " }),
        routeContext(category),
      );
      assert.equal(renamed.status, 200);
      assert.equal(((await renamed.json()) as CategorySummary).name, "Renamed");
    });

    test("rename and delete report not-found for a missing or malformed id", async () => {
      for (const id of [MISSING_ID, "not-a-uuid"]) {
        const rename = await renameCategoryRoute(
          request("PATCH", `/api/categories/${id}`, owner, { name: "x" }),
          routeContext(id),
        );
        assert.equal(rename.status, 404, id);
        const remove = await deleteCategoryRoute(request("DELETE", `/api/categories/${id}`, owner), routeContext(id));
        assert.equal(remove.status, 404, id);
      }
    });

    test("deleting a pack preserves every prompt in it, uncategorized but still listed", async () => {
      const packOwner = await registerAccount();
      const category = await createCategory(packOwner, `Doomed pack ${crypto.randomUUID()}`);
      const kept = await Promise.all([
        createPrompt(packOwner, { title: "Stays 1", text: "a", categoryId: category }),
        createPrompt(packOwner, { title: "Stays 2", text: "b", categoryId: category }),
      ]);
      assert.equal((await listPage(packOwner, `?category=${category}`)).total, 2);

      const deleted = await deleteCategoryRoute(
        request("DELETE", `/api/categories/${category}`, packOwner),
        routeContext(category),
      );
      assert.equal(deleted.status, 204);

      const again = await deleteCategoryRoute(
        request("DELETE", `/api/categories/${category}`, packOwner),
        routeContext(category),
      );
      assert.equal(again.status, 404);

      assert.equal((await listPage(packOwner, `?category=${category}`)).total, 0);
      const allPrompts = await listPage(packOwner);
      assert.equal(allPrompts.total, 2);
      for (const prompt of kept) {
        const fetched = await getPrompt(
          request("GET", `/api/prompts/${prompt.id}`, packOwner),
          routeContext(prompt.id),
        );
        assert.equal(fetched.status, 200);
        assert.equal(((await fetched.json()) as Prompt).category, null);
      }
    });
  },
);
