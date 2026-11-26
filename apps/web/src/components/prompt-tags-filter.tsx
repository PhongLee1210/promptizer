"use client";

import Link from "next/link";
import { CheckIcon, FilterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface TagFilterOption {
  tag: string;
  count: number;
  href: string;
  active: boolean;
}

interface PromptTagsFilterProps {
  options: TagFilterOption[];
  clearHref: string;
  activeTag: string;
}

export function PromptTagsFilter({ options, clearHref, activeTag }: PromptTagsFilterProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline">
          <FilterIcon aria-hidden="true" />
          {activeTag ? `Tag: ${activeTag}` : "Tags"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 w-60 overflow-y-auto">
        <DropdownMenuLabel>Filter by tag</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuItem key={option.tag} asChild>
            <Link href={option.href} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <CheckIcon aria-hidden="true" className={option.active ? "size-4" : "size-4 opacity-0"} />
                <span className="truncate">{option.tag}</span>
              </span>
              <span className="text-xs text-muted-foreground">{option.count}</span>
            </Link>
          </DropdownMenuItem>
        ))}
        {activeTag && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={clearHref}>Clear tag filter</Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
