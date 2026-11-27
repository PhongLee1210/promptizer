import { authenticate } from "@/lib/server/authenticate.ts";
import { failureResponse, jsonResponse, readJsonBody } from "@/lib/server/http.ts";
import { createPrompt, listPrompts } from "@/lib/server/prompts.ts";
import { parsePromptListQuery, validatePromptDraft } from "@/lib/server/validation.ts";

export async function POST(request: Request): Promise<Response> {
  const caller = await authenticate(request);
  if (!caller.ok) {
    return failureResponse(caller.failure);
  }
  const draft = validatePromptDraft(await readJsonBody(request));
  if (!draft.ok) {
    return failureResponse(draft.failure);
  }
  const created = await createPrompt(caller.value, draft.value);
  if (!created.ok) {
    return failureResponse(created.failure);
  }
  const response = jsonResponse(created.value, 201);
  response.headers.set("Location", `/api/prompts/${created.value.id}`);
  return response;
}

export async function GET(request: Request): Promise<Response> {
  const caller = await authenticate(request);
  if (!caller.ok) {
    return failureResponse(caller.failure);
  }
  const query = parsePromptListQuery(new URL(request.url).searchParams);
  if (!query.ok) {
    return failureResponse(query.failure);
  }
  const listed = await listPrompts(caller.value.accessToken, query.value);
  return listed.ok ? jsonResponse(listed.value, 200) : failureResponse(listed.failure);
}
