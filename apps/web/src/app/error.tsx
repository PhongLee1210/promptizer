"use client";

import { PromptsErrorState } from "@/components/prompts-error-state";

export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PromptsErrorState
      description="Something went wrong while loading this page. Try again, or go back to all prompts."
      reset={reset}
    />
  );
}
