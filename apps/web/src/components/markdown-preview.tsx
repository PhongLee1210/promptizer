"use client";

import { Component } from "react";
import type { ReactNode } from "react";
import { cn } from "cn";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MARKDOWN_PROSE_CLASS, renderMarkdown } from "@/lib/prompts/markdown-render";

interface MarkdownErrorBoundaryProps {
  source: string;
  children: ReactNode;
}

class MarkdownErrorBoundary extends Component<MarkdownErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(previousProps: MarkdownErrorBoundaryProps) {
    if (this.state.failed && previousProps.source !== this.props.source) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (this.state.failed) {
      return (
        <Alert variant="destructive">
          <AlertDescription>Preview unavailable for this text.</AlertDescription>
        </Alert>
      );
    }
    return this.props.children;
  }
}

function RenderedMarkdown({ source }: { source: string }) {
  return <>{renderMarkdown(source)}</>;
}

export function MarkdownPreview({ source, className }: { source: string; className?: string }) {
  return (
    <div className={cn(MARKDOWN_PROSE_CLASS, className)} data-testid="markdown-preview">
      <MarkdownErrorBoundary source={source}>
        <RenderedMarkdown source={source} />
      </MarkdownErrorBoundary>
    </div>
  );
}
