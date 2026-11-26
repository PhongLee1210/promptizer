import type { ReactNode } from "react";
import { AppShell } from "@/components/desktop/app-shell";
import { requireSignedInUser } from "@/lib/server/page-session";

export default async function ExamplesShellLayout({ children }: { children: ReactNode }) {
  const user = await requireSignedInUser("/examples");
  return <AppShell user={user}>{children}</AppShell>;
}
