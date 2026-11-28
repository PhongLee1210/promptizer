"use client";

import { PromptsErrorState } from "@/components/prompts-error-state";
import "./globals.css";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <PromptsErrorState
          description="Something went wrong while loading Promptizer. Try again, or go back to all prompts."
          reset={reset}
        />
      </body>
    </html>
  );
}
