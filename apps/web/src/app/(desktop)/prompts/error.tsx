"use client";

import { PromptsErrorState } from "@/components/prompts-error-state";

export default function PromptsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PromptsErrorState
      description="Something went wrong while loading your prompts. Try again, or go back to all prompts."
      reset={reset}
    />
  );
}
