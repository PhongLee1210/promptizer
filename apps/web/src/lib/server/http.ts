import type { Failure } from "./outcome.ts";

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function jsonResponse(body: unknown, status: number, setCookies: string[] = []): Response {
  const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" });
  setCookies.forEach((cookie) => headers.append("Set-Cookie", cookie));
  return new Response(JSON.stringify(body), { status, headers });
}

export function emptyResponse(setCookies: string[] = []): Response {
  const headers = new Headers({ "Cache-Control": "no-store" });
  setCookies.forEach((cookie) => headers.append("Set-Cookie", cookie));
  return new Response(null, { status: 204, headers });
}

export function failureResponse(failure: Failure, setCookies: string[] = []): Response {
  return jsonResponse(failure.body, failure.status, setCookies);
}
