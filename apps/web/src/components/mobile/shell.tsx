"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { AuthUser } from "@promptizer/shared";
import type { LucideIcon } from "lucide-react";
import { FileTextIcon, PlusIcon } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { AccountSheet } from "@/components/mobile/account-sheet";
import { HeaderSearch } from "@/components/mobile/header-search";

interface MobileShellProps {
  user: AuthUser;
  children: ReactNode;
}

interface TabItem {
  href: string;
  label: string;
  icon: LucideIcon;
  primary?: boolean;
}

const TAB_ITEMS: TabItem[] = [
  { href: "/prompts", label: "Prompts", icon: FileTextIcon },
  { href: "/prompts/new", label: "New", icon: PlusIcon, primary: true },
];

function normalizePathname(pathname: string): string {
  return pathname.replace(/^\/m(?=\/|$)/, "") || "/";
}

function isActiveTab(pathname: string, item: TabItem): boolean {
  if (item.href === "/prompts") return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function TabLink({ item, active }: { item: TabItem; active: boolean }) {
  const Icon = item.icon;
  const tone = active ? "text-primary" : "text-muted-foreground";
  const iconClass = item.primary
    ? "-mt-5 size-11 rounded-full bg-primary text-primary-foreground shadow-md ring-4 ring-background transition-transform duration-150 ease-out group-active/tab:scale-95 motion-reduce:transition-none"
    : "size-6";

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`group/tab flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors duration-150 ease-out motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${item.primary ? "text-foreground" : tone}`}
    >
      <span className={`flex items-center justify-center ${iconClass}`}>
        <Icon aria-hidden="true" className={item.primary ? "size-5" : "size-6"} />
      </span>
      <span>{item.label}</span>
    </Link>
  );
}

export function MobileShell({ user, children }: MobileShellProps) {
  const pathname = normalizePathname(usePathname());

  return (
    <div className="flex h-dvh flex-col">
      <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center justify-between gap-1 border-b bg-background px-3 pt-[env(safe-area-inset-top)] box-content">
        <BrandLogo />
        <div className="flex items-center gap-1">
          <HeaderSearch />
          <AccountSheet user={user} />
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">{children}</main>
      <nav
        aria-label="Primary"
        className="flex shrink-0 items-stretch border-t bg-background pb-[env(safe-area-inset-bottom)]"
      >
        {TAB_ITEMS.map((item) => (
          <TabLink key={item.href} item={item} active={isActiveTab(pathname, item)} />
        ))}
      </nav>
    </div>
  );
}
