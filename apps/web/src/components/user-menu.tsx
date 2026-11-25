"use client";

import Link from "next/link";
import { ChevronDownIcon, KeyRoundIcon, LogOutIcon } from "lucide-react";
import type { AuthUser } from "@promptizer/shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSignOut } from "@/hooks/use-sign-out";

interface UserMenuProps {
  user: AuthUser;
}

function initialsOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export function UserMenu({ user }: UserMenuProps) {
  const signOut = useSignOut();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" aria-label={`Account menu for ${user.name}`} className="gap-2">
          <span
            aria-hidden="true"
            className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
          >
            {initialsOf(user.name)}
          </span>
          <span className="hidden max-w-32 truncate sm:inline">{user.name}</span>
          <ChevronDownIcon aria-hidden="true" className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
          <span className="truncate text-sm font-medium">{user.name}</span>
          <span className="truncate text-xs text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account/password">
            <KeyRoundIcon aria-hidden="true" />
            Change password
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={signOut}>
          <LogOutIcon aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
