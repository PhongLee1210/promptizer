"use client";

import { PromptsErrorState } from "@/components/prompts-error-state";

export default function PromptsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PromptsErrorState reset={reset} />;
}
