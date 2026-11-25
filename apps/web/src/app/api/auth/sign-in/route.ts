import { signInWithPassword } from "../../../../lib/server/accounts.ts";
import { failureResponse, readJsonBody } from "../../../../lib/server/http.ts";
import { sessionResponse } from "../../../../lib/server/session-responses.ts";
import { validateSignIn } from "../../../../lib/server/validation.ts";

export async function POST(request: Request): Promise<Response> {
  const input = validateSignIn(await readJsonBody(request));
  if (!input.ok) {
    return failureResponse(input.failure);
  }
  return sessionResponse(await signInWithPassword(input.value), 200);
}
