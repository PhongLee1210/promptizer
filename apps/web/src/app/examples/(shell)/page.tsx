import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { exampleGroups } from "@/navigation/examples/example-pages";

export default function ExamplesPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Examples" />
      <p className="max-w-2xl text-sm text-muted-foreground">
        Pre-built pages and patterns to copy from when building a screen. They use sample data only.
      </p>
      {exampleGroups.map((group) => (
        <section key={group.label} className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">{group.label}</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {group.pages.map((page) => (
              <Link
                key={page.url}
                href={page.url}
                prefetch={false}
                className="rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
              >
                <Card className="h-full transition-colors hover:border-ring/50">
                  <CardHeader>
                    <CardTitle>{page.title}</CardTitle>
                    <CardDescription>{page.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
