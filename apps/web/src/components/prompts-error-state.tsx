"use client";

import { startTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PromptsErrorStateProps {
  description: string;
  reset: () => void;
}

export function PromptsErrorState({ description, reset }: PromptsErrorStateProps) {
  const router = useRouter();
  const retry = () => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  };
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <TriangleAlertIcon aria-hidden="true" className="size-6" />
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <h1 className="text-xl font-semibold">Could not load this page</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={retry}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/prompts">Go to all prompts</Link>
        </Button>
      </div>
    </main>
  );
}
