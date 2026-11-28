import { authenticate } from "@/lib/server/authenticate.ts";
import { createCategory } from "@/lib/server/categories.ts";
import { failureResponse, jsonResponse, readJsonBody } from "@/lib/server/http.ts";
import { validateCategoryDraft } from "@/lib/server/validation.ts";

export async function POST(request: Request): Promise<Response> {
  const caller = await authenticate(request);
  if (!caller.ok) {
    return failureResponse(caller.failure);
  }
  const draft = validateCategoryDraft(await readJsonBody(request));
  if (!draft.ok) {
    return failureResponse(draft.failure);
  }
  const created = await createCategory(caller.value, draft.value);
  if (!created.ok) {
    return failureResponse(created.failure);
  }
  const response = jsonResponse(created.value, 201);
  response.headers.set("Location", `/api/categories/${created.value.id}`);
  return response;
}
