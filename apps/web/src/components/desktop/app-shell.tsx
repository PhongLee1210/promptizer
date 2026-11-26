"use client";

import type { ReactNode } from "react";
import type { AuthUser } from "@promptizer/shared";
import { AppSidebar } from "@/components/desktop/app-sidebar";
import { GlobalSearch } from "@/components/global-search";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

interface AppShellProps {
  user: AuthUser;
  children: ReactNode;
}

export function AppShell({ user, children }: AppShellProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-3">
          <SidebarTrigger aria-label="Toggle sidebar" />
          <div className="flex flex-1 justify-center sm:justify-start">
            <GlobalSearch />
          </div>
          <ThemeToggle />
          <UserMenu user={user} />
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
