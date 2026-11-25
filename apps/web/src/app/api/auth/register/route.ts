import { registerAccount } from "@/lib/server/accounts.ts";
import { failureResponse, readJsonBody } from "@/lib/server/http.ts";
import { sessionResponse } from "@/lib/server/session-responses.ts";
import { validateRegistration } from "@/lib/server/validation.ts";

export async function POST(request: Request): Promise<Response> {
  const input = validateRegistration(await readJsonBody(request));
  if (!input.ok) {
    return failureResponse(input.failure);
  }
  return sessionResponse(request, await registerAccount(input.value), 201);
}
