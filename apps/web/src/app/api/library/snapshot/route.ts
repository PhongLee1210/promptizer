import { authenticate } from "@/lib/server/authenticate.ts";
import { failureResponse, jsonResponse } from "@/lib/server/http.ts";
import { getLibrarySnapshot } from "@/lib/server/library.ts";

export async function GET(request: Request): Promise<Response> {
  const caller = await authenticate(request);
  if (!caller.ok) {
    return failureResponse(caller.failure);
  }
  const snapshot = await getLibrarySnapshot(caller.value.accessToken);
  return snapshot.ok ? jsonResponse(snapshot.value, 200) : failureResponse(snapshot.failure);
}
