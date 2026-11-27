import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeftIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PageHeaderBackLink {
  href: string;
  label: string;
}

interface PageHeaderProps {
  title: string;
  count?: number;
  back?: PageHeaderBackLink;
  actions?: ReactNode;
}

export function PageHeader({ title, count, back, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-2">
      {back && (
        <Button asChild variant="ghost" size="sm" className="-ml-2.5 w-fit text-muted-foreground">
          <Link href={back.href}>
            <ArrowLeftIcon aria-hidden="true" />
            {back.label}
          </Link>
        </Button>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight break-words">{title}</h1>
          {count !== undefined && (
            <Badge variant="secondary" aria-label={`${count} items`}>
              {count}
            </Badge>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
