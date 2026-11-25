import type { ReactNode } from "react";
import { AppShell } from "@/components/desktop/app-shell";
import { requireSignedInUser } from "@/lib/server/page-session";

interface AppPageProps {
  path: string;
  children: ReactNode;
}

export async function AppPage({ path, children }: AppPageProps) {
  const user = await requireSignedInUser(path);
  return <AppShell user={user}>{children}</AppShell>;
}
