"use client";

import Link from "next/link";
import { CheckIcon, FilterIcon, FolderIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface FilterMenuOption {
  value: string;
  label: string;
  count?: number;
  href: string;
  active: boolean;
}

interface PromptFilterMenuProps {
  icon: LucideIcon;
  triggerLabel: string;
  menuLabel: string;
  clearLabel: string;
  options: FilterMenuOption[];
  clearHref?: string;
}

function PromptFilterMenu({
  icon: Icon,
  triggerLabel,
  menuLabel,
  clearLabel,
  options,
  clearHref,
}: PromptFilterMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline">
          <Icon aria-hidden="true" />
          {triggerLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 w-60 overflow-y-auto">
        <DropdownMenuLabel>{menuLabel}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuItem key={option.value} asChild>
            <Link href={option.href} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <CheckIcon aria-hidden="true" className={option.active ? "size-4" : "size-4 opacity-0"} />
                <span className="truncate">{option.label}</span>
              </span>
              {option.count !== undefined && <span className="text-xs text-muted-foreground">{option.count}</span>}
            </Link>
          </DropdownMenuItem>
        ))}
        {clearHref && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={clearHref}>{clearLabel}</Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface PromptFilterProps {
  options: FilterMenuOption[];
  clearHref: string;
  activeLabel?: string;
}

export function PromptTagsFilter({ options, clearHref, activeLabel }: PromptFilterProps) {
  return (
    <PromptFilterMenu
      icon={FilterIcon}
      triggerLabel={activeLabel ? `Tag: ${activeLabel}` : "Tags"}
      menuLabel="Filter by tag"
      clearLabel="Clear tag filter"
      options={options}
      clearHref={activeLabel ? clearHref : undefined}
    />
  );
}

export function PromptCategoryFilter({ options, clearHref, activeLabel }: PromptFilterProps) {
  return (
    <PromptFilterMenu
      icon={FolderIcon}
      triggerLabel={activeLabel ? `Category: ${activeLabel}` : "Category"}
      menuLabel="Filter by category"
      clearLabel="Clear category filter"
      options={options}
      clearHref={activeLabel ? clearHref : undefined}
    />
  );
}
