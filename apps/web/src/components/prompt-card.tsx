import Link from "next/link";

const PREVIEW_LINE_COUNT = 4;
const PREVIEW_LINE_CLAMP_CLASS = "line-clamp-4";

interface PromptCardProps {
  id: string;
  title: string;
  previewText: string;
  updatedAt: Date;
}

const updatedAtFormatter = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

export function PromptCard({ id, title, previewText, updatedAt }: PromptCardProps) {
  return (
    <Link
      href={`/prompts/${id}`}
      data-preview-lines={PREVIEW_LINE_COUNT}
      className="group flex h-full flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground transition-[box-shadow,transform,border-color] duration-150 hover:-translate-y-0.5 hover:border-ring/50 hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <h3 className="truncate text-base font-semibold">{title}</h3>
      <p className={`${PREVIEW_LINE_CLAMP_CLASS} grow text-sm whitespace-pre-line text-muted-foreground`}>
        {previewText}
      </p>
      <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
        <time dateTime={updatedAt.toISOString()}>{updatedAtFormatter.format(updatedAt)}</time>
      </div>
    </Link>
  );
}
