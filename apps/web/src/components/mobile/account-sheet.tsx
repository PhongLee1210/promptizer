"use client";

import Link from "next/link";
import { KeyRoundIcon, LogOutIcon, MoonIcon, SunIcon } from "lucide-react";
import type { AuthUser } from "@promptizer/shared";
import { applyThemeMode } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useSignOut } from "@/hooks/use-sign-out";
import { useThemeMode } from "@/hooks/use-theme-mode";

interface AccountSheetProps {
  user: AuthUser;
}

const SHEET_ROW_CLASS = "h-12 w-full justify-start gap-3 text-base";

function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export function AccountSheet({ user }: AccountSheetProps) {
  const signOut = useSignOut();
  const mode = useThemeMode();
  const nextMode = mode === "dark" ? "light" : "dark";
  const ModeIcon = mode === "dark" ? SunIcon : MoonIcon;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label={`Account menu for ${user.name}`}>
          <span
            aria-hidden="true"
            className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
          >
            {initialOf(user.name)}
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="gap-0 rounded-t-xl pb-[env(safe-area-inset-bottom)]">
        <SheetHeader>
          <SheetTitle className="truncate">{user.name}</SheetTitle>
          <SheetDescription className="truncate">{user.email}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-1 px-2 pb-2">
          <Button asChild variant="ghost" className={SHEET_ROW_CLASS}>
            <Link href="/account/password">
              <KeyRoundIcon aria-hidden="true" />
              Change password
            </Link>
          </Button>
          <Button type="button" variant="ghost" className={SHEET_ROW_CLASS} onClick={() => applyThemeMode(nextMode)}>
            <ModeIcon aria-hidden="true" />
            Switch to {nextMode} mode
          </Button>
          <Button type="button" variant="ghost" className={SHEET_ROW_CLASS} onClick={signOut}>
            <LogOutIcon aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
