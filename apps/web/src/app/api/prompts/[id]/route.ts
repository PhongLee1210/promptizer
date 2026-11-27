import { authenticate } from "@/lib/server/authenticate.ts";
import { emptyResponse, failureResponse, jsonResponse, readJsonBody } from "@/lib/server/http.ts";
import { deletePrompt, findPrompt, updatePrompt } from "@/lib/server/prompts.ts";
import { validatePromptChanges } from "@/lib/server/validation.ts";

interface PromptRouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: PromptRouteContext): Promise<Response> {
  const caller = await authenticate(request);
  if (!caller.ok) {
    return failureResponse(caller.failure);
  }
  const found = await findPrompt(caller.value.accessToken, (await params).id);
  return found.ok ? jsonResponse(found.value, 200) : failureResponse(found.failure);
}

export async function PATCH(request: Request, { params }: PromptRouteContext): Promise<Response> {
  const caller = await authenticate(request);
  if (!caller.ok) {
    return failureResponse(caller.failure);
  }
  const changes = validatePromptChanges(await readJsonBody(request));
  if (!changes.ok) {
    return failureResponse(changes.failure);
  }
  const updated = await updatePrompt(caller.value.accessToken, (await params).id, changes.value);
  return updated.ok ? jsonResponse(updated.value, 200) : failureResponse(updated.failure);
}

export async function DELETE(request: Request, { params }: PromptRouteContext): Promise<Response> {
  const caller = await authenticate(request);
  if (!caller.ok) {
    return failureResponse(caller.failure);
  }
  const deleted = await deletePrompt(caller.value.accessToken, (await params).id);
  return deleted.ok ? emptyResponse() : failureResponse(deleted.failure);
}
