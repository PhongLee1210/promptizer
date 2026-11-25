import Link from "next/link";
import { CompassIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <CompassIcon aria-hidden="true" className="size-6" />
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="text-sm text-muted-foreground">The page you are looking for does not exist or has moved.</p>
      </div>
      <Button asChild>
        <Link href="/prompts">Go to all prompts</Link>
      </Button>
    </main>
  );
}
