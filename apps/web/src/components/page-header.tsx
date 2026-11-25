import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

interface PageHeaderProps {
  title: string;
  count?: number;
  actions?: ReactNode;
}

export function PageHeader({ title, count, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {count !== undefined && (
          <Badge variant="secondary" aria-label={`${count} items`}>
            {count}
          </Badge>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
