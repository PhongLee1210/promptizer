import type { LibrarySnapshot } from "@promptizer/shared";
import { listPacksWithCounts } from "./categories.ts";
import type { Outcome } from "./outcome.ts";
import { succeed } from "./outcome.ts";
import { listAllPrompts } from "./prompts.ts";

export async function getLibrarySnapshot(accessToken: string): Promise<Outcome<LibrarySnapshot>> {
  const [prompts, packs] = await Promise.all([listAllPrompts(accessToken), listPacksWithCounts(accessToken)]);
  if (!prompts.ok) {
    return prompts;
  }
  if (!packs.ok) {
    return packs;
  }
  return succeed({ prompts: prompts.value, packs: packs.value, fetchedAt: Math.floor(Date.now() / 1000) });
}
