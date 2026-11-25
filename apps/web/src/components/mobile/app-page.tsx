import type { ReactNode } from "react";
import { MobileShell } from "@/components/mobile/shell";
import { requireSignedInUser } from "@/lib/server/page-session";

interface AppPageProps {
  path: string;
  children: ReactNode;
}

export async function AppPage({ path, children }: AppPageProps) {
  const user = await requireSignedInUser(path);
  return <MobileShell user={user}>{children}</MobileShell>;
}
