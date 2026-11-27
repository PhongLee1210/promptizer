import { createElement } from "react";
import type { ReactNode } from "react";
import { excerptBlocks, parseMarkdown } from "./markdown.ts";
import type { MarkdownBlock, MarkdownInline } from "./markdown.ts";

export interface MarkdownRenderOptions {
  linksAsText?: boolean;
  headingsAsText?: boolean;
  maxCharacters?: number;
}

export const MARKDOWN_PROSE_CLASS =
  "text-sm leading-relaxed break-words [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-semibold [&_h4]:font-semibold [&_h5]:font-semibold [&_h6]:font-semibold [&>*+*]:mt-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:text-foreground [&_code]:font-mono [&_code]:text-[0.85em] [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0";

const EXTERNAL_LINK_REL = "noopener noreferrer nofollow";
const DEEPEST_HEADING_LEVEL = 6;

function documentHeadingTag(markdownLevel: number): string {
  return `h${Math.min(markdownLevel + 1, DEEPEST_HEADING_LEVEL)}`;
}

function renderInlines(nodes: MarkdownInline[], options: MarkdownRenderOptions): ReactNode[] {
  return nodes.map((node, index) => {
    switch (node.kind) {
      case "text":
        return node.text;
      case "code":
        return createElement("code", { key: index }, node.text);
      case "strong":
        return createElement("strong", { key: index }, ...renderInlines(node.children, options));
      case "emphasis":
        return createElement("em", { key: index }, ...renderInlines(node.children, options));
      case "link":
        return options.linksAsText
          ? createElement("span", { key: index }, ...renderInlines(node.children, options))
          : createElement(
              "a",
              { key: index, href: node.href, rel: EXTERNAL_LINK_REL, target: "_blank" },
              ...renderInlines(node.children, options),
            );
    }
  });
}

function renderBlock(block: MarkdownBlock, index: number, options: MarkdownRenderOptions): ReactNode {
  switch (block.kind) {
    case "heading":
      return options.headingsAsText
        ? createElement("p", { key: index }, createElement("strong", null, ...renderInlines(block.children, options)))
        : createElement(documentHeadingTag(block.level), { key: index }, ...renderInlines(block.children, options));
    case "paragraph":
      return createElement("p", { key: index }, ...renderInlines(block.children, options));
    case "list":
      return createElement(
        block.ordered ? "ol" : "ul",
        { key: index, start: block.ordered && block.start !== 1 ? block.start : undefined },
        ...block.items.map((item, itemIndex) =>
          createElement("li", { key: itemIndex }, ...renderInlines(item, options)),
        ),
      );
    case "codeBlock":
      return createElement(
        "pre",
        { key: index },
        createElement("code", { "data-language": block.language || undefined }, block.text),
      );
  }
}

export function renderMarkdown(source: string, options: MarkdownRenderOptions = {}): ReactNode {
  const blocks = parseMarkdown(source);
  const visibleBlocks = options.maxCharacters === undefined ? blocks : excerptBlocks(blocks, options.maxCharacters);
  return visibleBlocks.map((block, index) => renderBlock(block, index, options));
}
