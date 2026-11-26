import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const SKELETON_CARD_COUNT = 4;

export function PromptGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">{children}</div>;
}

export function PromptGridSkeleton() {
  return (
    <PromptGrid>
      {Array.from({ length: SKELETON_CARD_COUNT }, (_, index) => (
        <Skeleton key={index} className="h-72 rounded-xl" />
      ))}
    </PromptGrid>
  );
}
