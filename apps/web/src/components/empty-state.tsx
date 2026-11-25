import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface StateAction {
  label: string;
  href: string;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action: StateAction;
  children?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action, children }: EmptyStateProps) {
  return (
    <section className="flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-10 text-center md:flex-1 md:justify-center md:py-16">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon aria-hidden="true" className="size-6" />
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Button asChild>
        <Link href={action.href}>{action.label}</Link>
      </Button>
      {children}
    </section>
  );
}
