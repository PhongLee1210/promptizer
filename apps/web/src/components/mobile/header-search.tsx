"use client";

import { useState } from "react";
import { ArrowLeftIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function HeaderSearch() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" variant="ghost" size="icon" aria-label="Search prompts" onClick={() => setOpen(true)}>
        <SearchIcon aria-hidden="true" />
      </Button>
    );
  }

  return (
    <form
      role="search"
      action="/prompts"
      method="GET"
      className="absolute inset-x-0 bottom-0 flex h-12 items-center gap-1 bg-background px-3"
    >
      <Button type="button" variant="ghost" size="icon" aria-label="Close search" onClick={() => setOpen(false)}>
        <ArrowLeftIcon aria-hidden="true" />
      </Button>
      <Input
        type="search"
        name="q"
        aria-label="Search prompts"
        placeholder="Search prompts"
        autoFocus
        className="h-9"
      />
    </form>
  );
}
