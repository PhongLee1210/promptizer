import { CLIENT_KIND_HEADER, EXTENSION_CLIENT_KIND } from "@promptizer/shared";
import type { ApiErrorBody, LibrarySnapshot } from "@promptizer/shared";

export type LibraryClientError = { kind: "unauthenticated" | "retryable"; message: string };

export type LibraryClientResult<Value> = { ok: true; value: Value } | { ok: false; error: LibraryClientError };

export interface LibraryClient {
  fetchSnapshot(accessToken: string): Promise<LibraryClientResult<LibrarySnapshot>>;
}

const RETRYABLE_ERROR: LibraryClientError = {
  kind: "retryable",
  message: "Couldn't reach Promptizer. Check your connection and try again.",
};

function mapFailure(status: number, body: ApiErrorBody | undefined): LibraryClientError {
  if (status === 401 || body?.code === "unauthenticated") {
    return { kind: "unauthenticated", message: body?.message ?? "Please sign in again." };
  }
  return RETRYABLE_ERROR;
}

async function readErrorBody(response: Response): Promise<ApiErrorBody | undefined> {
  try {
    return (await response.json()) as ApiErrorBody;
  } catch {
    return undefined;
  }
}

export function createLibraryClient(apiOrigin: string, fetchImplementation: typeof fetch = fetch): LibraryClient {
  return {
    async fetchSnapshot(accessToken) {
      let response: Response;
      try {
        response = await fetchImplementation(`${apiOrigin}/api/library/snapshot`, {
          method: "GET",
          headers: { Authorization: `Bearer ${accessToken}`, [CLIENT_KIND_HEADER]: EXTENSION_CLIENT_KIND },
        });
      } catch {
        return { ok: false, error: RETRYABLE_ERROR };
      }
      if (!response.ok) {
        return { ok: false, error: mapFailure(response.status, await readErrorBody(response)) };
      }
      try {
        return { ok: true, value: (await response.json()) as LibrarySnapshot };
      } catch {
        return { ok: false, error: RETRYABLE_ERROR };
      }
    },
  };
}
