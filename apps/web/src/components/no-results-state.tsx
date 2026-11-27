import Link from "next/link";
import { SearchXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

interface NoResultsStateProps {
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
}

export function NoResultsState({ title, description, actionLabel, actionHref }: NoResultsStateProps) {
  return (
    <Empty className="border border-dashed md:flex-1">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchXIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
