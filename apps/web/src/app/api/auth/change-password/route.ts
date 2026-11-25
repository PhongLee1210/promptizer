import { changePassword } from "../../../../lib/server/accounts.ts";
import { authenticate } from "../../../../lib/server/authenticate.ts";
import { failureResponse, readJsonBody } from "../../../../lib/server/http.ts";
import { sessionResponse } from "../../../../lib/server/session-responses.ts";
import { validateChangePassword } from "../../../../lib/server/validation.ts";

export async function POST(request: Request): Promise<Response> {
  const caller = await authenticate(request);
  if (!caller.ok) {
    return failureResponse(caller.failure);
  }
  const input = validateChangePassword(await readJsonBody(request));
  if (!input.ok) {
    return failureResponse(input.failure);
  }
  return sessionResponse(await changePassword(caller.value.user, input.value), 200);
}
