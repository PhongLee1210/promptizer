import type {
  ApiErrorBody,
  CategoryChanges,
  CategoryDraft,
  CategoryFieldErrors,
  CategorySummary,
} from "@promptizer/shared";

export type CategoryRequestFailureKind = "validation" | "unauthenticated" | "not_found" | "network" | "server";

export type CategoryRequestResult =
  | { ok: true; category?: CategorySummary }
  | { ok: false; kind: CategoryRequestFailureKind; message: string; fields?: CategoryFieldErrors };

export type FetchFunction = (input: string, init: RequestInit) => Promise<Response>;

const CATEGORIES_ENDPOINT = "/api/categories";
const SERVER_FAILURE_MESSAGE = "Something went wrong. Please try again.";
const UNREACHABLE_MESSAGE = "Couldn't reach the server. Check your connection and try again.";
const browserFetch: FetchFunction = (input, init) => fetch(input, init);

function failureKindFor(status: number, body: ApiErrorBody | undefined): CategoryRequestFailureKind {
  if (status === 401 || body?.code === "unauthenticated") return "unauthenticated";
  if (status === 404 || body?.code === "not_found") return "not_found";
  if (status === 422 || body?.code === "validation_failed") return "validation";
  return "server";
}

async function sendCategoryRequest(
  fetchFunction: FetchFunction,
  path: string,
  init: RequestInit,
): Promise<CategoryRequestResult> {
  let response: Response;
  try {
    response = await fetchFunction(path, { credentials: "same-origin", ...init });
  } catch {
    return { ok: false, kind: "network", message: UNREACHABLE_MESSAGE };
  }
  if (response.status === 204) {
    return { ok: true };
  }
  const body = (await response.json().catch(() => undefined)) as CategorySummary | ApiErrorBody | undefined;
  if (response.ok) {
    return { ok: true, category: body as CategorySummary };
  }
  const errorBody = body as ApiErrorBody | undefined;
  return {
    ok: false,
    kind: failureKindFor(response.status, errorBody),
    message: errorBody?.message ?? SERVER_FAILURE_MESSAGE,
    fields: errorBody?.fields as CategoryFieldErrors | undefined,
  };
}

function jsonInit(method: string, payload: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) };
}

export function createCategoryRequest(draft: CategoryDraft, fetchFunction: FetchFunction = browserFetch) {
  return sendCategoryRequest(fetchFunction, CATEGORIES_ENDPOINT, jsonInit("POST", draft));
}

export function renameCategoryRequest(
  id: string,
  changes: CategoryChanges,
  fetchFunction: FetchFunction = browserFetch,
) {
  return sendCategoryRequest(
    fetchFunction,
    `${CATEGORIES_ENDPOINT}/${encodeURIComponent(id)}`,
    jsonInit("PATCH", changes),
  );
}

export function deleteCategoryRequest(id: string, fetchFunction: FetchFunction = browserFetch) {
  return sendCategoryRequest(fetchFunction, `${CATEGORIES_ENDPOINT}/${encodeURIComponent(id)}`, { method: "DELETE" });
}
