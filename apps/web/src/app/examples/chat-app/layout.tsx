import type { ReactNode } from "react";

import { requireSignedInUser } from "@/lib/server/page-session";
import { SidebarProvider } from "@/components/ui/sidebar";

import { ChatHeader } from "./_components/chat-header";
import { ChatSidebar } from "./_components/chat-sidebar";

export default async function Layout({ children }: Readonly<{ children: ReactNode }>) {
  await requireSignedInUser("/examples/chat-app");
  return (
    <div className="[--header-height:calc(--spacing(14))]">
      <SidebarProvider className="flex flex-col">
        <ChatHeader />
        <div className="flex flex-1">
          <ChatSidebar />
          {children}
        </div>
      </SidebarProvider>
    </div>
  );
}
