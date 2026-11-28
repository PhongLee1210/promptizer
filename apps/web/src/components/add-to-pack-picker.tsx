"use client";

import { usePathname, useRouter } from "next/navigation";
import { useId, useState } from "react";
import type { FormEvent } from "react";
import type { Prompt, PromptListPage } from "@promptizer/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { savePromptRequest } from "@/lib/prompts/prompt-client";
import { signInUrlFor } from "@/lib/safe-redirect";

async function searchPrompts(query: string): Promise<Prompt[]> {
  const response = await fetch(`/api/prompts?q=${encodeURIComponent(query)}&pageSize=10`, {
    credentials: "same-origin",
  });
  if (!response.ok) {
    return [];
  }
  const page = (await response.json()) as PromptListPage;
  return page.items;
}

export function AddToPackPicker({ packId }: { packId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Prompt[]>([]);
  const [busyId, setBusyId] = useState<string>();
  const [open, setOpen] = useState(false);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResults((await searchPrompts(query)).filter((prompt) => prompt.category?.id !== packId));
    setOpen(true);
  }

  async function handleAdd(promptId: string) {
    setBusyId(promptId);
    const result = await savePromptRequest(promptId, { categoryId: packId }, { keepalive: false });
    if (result.ok) {
      setResults((current) => current.filter((prompt) => prompt.id !== promptId));
      router.refresh();
      return;
    }
    setBusyId(undefined);
    if (result.kind === "unauthenticated") {
      router.replace(signInUrlFor(pathname));
    }
  }

  return (
    <section aria-labelledby={`${inputId}-label`} className="flex flex-col gap-2 rounded-lg border p-3">
      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          id={inputId}
          aria-label="Search prompts to add"
          placeholder="Add a prompt to this pack…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>
      {open && (
        <ul className="flex flex-col gap-1">
          {results.length === 0 ? (
            <li className="text-sm text-muted-foreground">No prompts found.</li>
          ) : (
            results.map((prompt) => (
              <li
                key={prompt.id}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-muted"
              >
                <span className="truncate text-sm">{prompt.title}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busyId === prompt.id}
                  onClick={() => handleAdd(prompt.id)}
                >
                  Add
                </Button>
              </li>
            ))
          )}
        </ul>
      )}
    </section>
  );
}
