import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { AuthUser } from "@promptizer/shared";
import { signInUrlFor } from "../safe-redirect.ts";
import { resolveUser } from "./accounts.ts";
import { ACCESS_COOKIE } from "./session-cookies.ts";

const readSignedInUser = cache(async (): Promise<AuthUser | undefined> => {
  const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!accessToken) {
    return undefined;
  }
  const resolved = await resolveUser(accessToken);
  return resolved.ok ? resolved.value : undefined;
});

export async function requireSignedInUser(currentPath: string): Promise<AuthUser> {
  const user = await readSignedInUser();
  if (!user) {
    redirect(signInUrlFor(currentPath));
  }
  return user;
}

export async function redirectAwayWhenSignedIn(destination: string): Promise<void> {
  if (await readSignedInUser()) {
    redirect(destination);
  }
}
