"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRightIcon, FileTextIcon, LayersIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { usePersistedOpen } from "@/hooks/use-persisted-open";

const PACKS_SECTION_STORAGE_KEY = "promptizer-sidebar-packs-open";

const ALL_PROMPTS_HREF = "/prompts";
const PACKS_HREF = "/packs";

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function PacksMenuItem({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  const [open, setOpen] = usePersistedOpen(PACKS_SECTION_STORAGE_KEY, true);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActivePath(pathname, PACKS_HREF)}>
        <Link href={PACKS_HREF} onClick={onNavigate}>
          <LayersIcon aria-hidden="true" />
          <span>Prompt packs</span>
        </Link>
      </SidebarMenuButton>
      <SidebarMenuAction
        aria-label={open ? "Collapse packs" : "Expand packs"}
        aria-expanded={open}
        aria-controls="sidebar-packs-list"
        onClick={() => setOpen(!open)}
      >
        <ChevronRightIcon aria-hidden="true" className={`transition-transform ${open ? "rotate-90" : ""}`} />
      </SidebarMenuAction>
      <SidebarMenuSub id="sidebar-packs-list" hidden={!open}>
        <SidebarMenuSubItem>
          <p className="py-1 text-sm text-muted-foreground">
            No packs yet.{" "}
            <Link
              href={PACKS_HREF}
              onClick={onNavigate}
              className="rounded-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring"
            >
              Create one
            </Link>
          </p>
        </SidebarMenuSubItem>
      </SidebarMenuSub>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const closeMobileSidebar = () => setOpenMobile(false);

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="gap-3 p-3">
        <Link
          href="/prompts"
          className="rounded-md px-2 py-1 text-base font-semibold tracking-tight focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          Promptizer
        </Link>
        <Button asChild className="w-full justify-start">
          <Link href="/prompts/new" onClick={closeMobileSidebar}>
            <PlusIcon aria-hidden="true" />
            New prompt
          </Link>
        </Button>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActivePath(pathname, ALL_PROMPTS_HREF)}>
                  <Link href={ALL_PROMPTS_HREF} onClick={closeMobileSidebar}>
                    <FileTextIcon aria-hidden="true" />
                    <span>All prompts</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <PacksMenuItem pathname={pathname} onNavigate={closeMobileSidebar} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
