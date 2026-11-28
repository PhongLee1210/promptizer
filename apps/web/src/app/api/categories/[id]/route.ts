import { authenticate } from "@/lib/server/authenticate.ts";
import { deleteCategory, renameCategory } from "@/lib/server/categories.ts";
import { emptyResponse, failureResponse, jsonResponse, readJsonBody } from "@/lib/server/http.ts";
import { validateCategoryChanges } from "@/lib/server/validation.ts";

interface CategoryRouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: CategoryRouteContext): Promise<Response> {
  const caller = await authenticate(request);
  if (!caller.ok) {
    return failureResponse(caller.failure);
  }
  const changes = validateCategoryChanges(await readJsonBody(request));
  if (!changes.ok) {
    return failureResponse(changes.failure);
  }
  const renamed = await renameCategory(caller.value.accessToken, (await params).id, changes.value);
  return renamed.ok ? jsonResponse(renamed.value, 200) : failureResponse(renamed.failure);
}

export async function DELETE(request: Request, { params }: CategoryRouteContext): Promise<Response> {
  const caller = await authenticate(request);
  if (!caller.ok) {
    return failureResponse(caller.failure);
  }
  const deleted = await deleteCategory(caller.value.accessToken, (await params).id);
  return deleted.ok ? emptyResponse() : failureResponse(deleted.failure);
}
