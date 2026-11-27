export type MarkdownInline =
  | { kind: "text"; text: string }
  | { kind: "strong"; children: MarkdownInline[] }
  | { kind: "emphasis"; children: MarkdownInline[] }
  | { kind: "code"; text: string }
  | { kind: "link"; href: string; children: MarkdownInline[] };

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type MarkdownBlock =
  | { kind: "heading"; level: HeadingLevel; children: MarkdownInline[] }
  | { kind: "paragraph"; children: MarkdownInline[] }
  | { kind: "list"; ordered: boolean; start: number; items: MarkdownInline[][] }
  | { kind: "codeBlock"; language: string; text: string };

export const MAX_INLINE_NESTING_DEPTH = 8;

const SAFE_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);
const LINE_BREAK_PATTERN = /\r\n|\r|\n/;
const FENCE_OPEN_PATTERN = /^ {0,3}(`{3,}|~{3,})[ \t]*([^`\s]*)/;
const HEADING_PATTERN = /^ {0,3}(#{1,6})(?:[ \t]+|$)(.*)$/;
const UNORDERED_ITEM_PATTERN = /^ {0,3}[-*+][ \t]+(.*)$/;
const ORDERED_ITEM_PATTERN = /^ {0,3}(\d{1,9})[.)][ \t]+(.*)$/;
const CONTINUATION_PATTERN = /^[ \t]+\S/;
const ESCAPABLE_PATTERN = /[!-/:-@[-`{-~]/;
const WORD_CHARACTER_PATTERN = /[\p{L}\p{N}]/u;

export function safeHref(raw: string): string | undefined {
  try {
    const url = new URL(raw.trim());
    return SAFE_LINK_PROTOCOLS.has(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function createFinder(text: string) {
  const searches = new Map<string, { from: number; found: number }>();
  return (needle: string, from: number): number => {
    const previous = searches.get(needle);
    if (previous && from >= previous.from && (previous.found === -1 || from <= previous.found)) {
      return previous.found;
    }
    const found = text.indexOf(needle, from);
    searches.set(needle, { from, found });
    return found;
  };
}

function backtickRunLength(text: string, start: number): number {
  let end = start;
  while (text[end] === "`") end += 1;
  return end - start;
}

function findClosingBackticks(text: string, from: number, runLength: number): number {
  let position = text.indexOf("`", from);
  while (position !== -1) {
    const length = backtickRunLength(text, position);
    if (length === runLength) {
      return position;
    }
    position = text.indexOf("`", position + length);
  }
  return -1;
}

export function parseInline(text: string, depth = 0): MarkdownInline[] {
  if (depth >= MAX_INLINE_NESTING_DEPTH) {
    return text ? [{ kind: "text", text }] : [];
  }
  const nodes: MarkdownInline[] = [];
  const find = createFinder(text);
  let buffer = "";
  const flush = () => {
    if (buffer) {
      nodes.push({ kind: "text", text: buffer });
      buffer = "";
    }
  };
  let index = 0;
  let unmatchedBacktickRun = 0;
  while (index < text.length) {
    const character = text[index];
    if (character === "\\" && index + 1 < text.length && ESCAPABLE_PATTERN.test(text[index + 1])) {
      buffer += text[index + 1];
      index += 2;
      continue;
    }
    if (character === "`") {
      const runLength = backtickRunLength(text, index);
      const closing =
        runLength === unmatchedBacktickRun ? -1 : findClosingBackticks(text, index + runLength, runLength);
      if (closing === -1) {
        unmatchedBacktickRun = runLength;
        buffer += text.slice(index, index + runLength);
        index += runLength;
        continue;
      }
      flush();
      nodes.push({ kind: "code", text: text.slice(index + runLength, closing) });
      index = closing + runLength;
      continue;
    }
    if (character === "*" || character === "_") {
      const marker = text[index + 1] === character ? character + character : character;
      const contentStart = index + marker.length;
      const precededByWord = index > 0 && WORD_CHARACTER_PATTERN.test(text[index - 1]);
      const closing = character === "_" && precededByWord ? -1 : find(marker, contentStart);
      const content = closing === -1 ? "" : text.slice(contentStart, closing);
      if (closing === -1 || content.trim() === "" || /^\s/.test(content)) {
        buffer += marker;
        index = contentStart;
        continue;
      }
      flush();
      nodes.push({
        kind: marker.length === 2 ? "strong" : "emphasis",
        children: parseInline(content, depth + 1),
      });
      index = closing + marker.length;
      continue;
    }
    if (character === "[") {
      const labelEnd = find("]", index + 1);
      const destinationEnd = labelEnd !== -1 && text[labelEnd + 1] === "(" ? find(")", labelEnd + 2) : -1;
      if (destinationEnd === -1) {
        buffer += character;
        index += 1;
        continue;
      }
      const href = safeHref(text.slice(labelEnd + 2, destinationEnd));
      const label = text.slice(index + 1, labelEnd);
      if (!href || label.trim() === "") {
        buffer += text.slice(index, destinationEnd + 1);
        index = destinationEnd + 1;
        continue;
      }
      flush();
      nodes.push({ kind: "link", href, children: parseInline(label, depth + 1) });
      index = destinationEnd + 1;
      continue;
    }
    buffer += character;
    index += 1;
  }
  flush();
  return nodes;
}

function headingText(raw: string): string {
  let text = raw.trimEnd();
  let end = text.length;
  while (end > 0 && text[end - 1] === "#") end -= 1;
  if (end === 0 || /[ \t]/.test(text[end - 1])) {
    text = text.slice(0, end);
  }
  return text.trim();
}

function isBlockStart(line: string): boolean {
  return (
    FENCE_OPEN_PATTERN.test(line) ||
    HEADING_PATTERN.test(line) ||
    UNORDERED_ITEM_PATTERN.test(line) ||
    ORDERED_ITEM_PATTERN.test(line)
  );
}

function isClosingFence(line: string, fence: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < fence.length || line.length - line.trimStart().length > 3) {
    return false;
  }
  for (const character of trimmed) {
    if (character !== fence[0]) return false;
  }
  return true;
}

export function parseMarkdown(source: string): MarkdownBlock[] {
  const lines = source.split(LINE_BREAK_PATTERN);
  const blocks: MarkdownBlock[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === "") {
      index += 1;
      continue;
    }
    const fence = FENCE_OPEN_PATTERN.exec(line);
    if (fence) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !isClosingFence(lines[index], fence[1])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push({ kind: "codeBlock", language: fence[2], text: codeLines.join("\n") });
      continue;
    }
    const heading = HEADING_PATTERN.exec(line);
    if (heading) {
      blocks.push({
        kind: "heading",
        level: heading[1].length as HeadingLevel,
        children: parseInline(headingText(heading[2])),
      });
      index += 1;
      continue;
    }
    const ordered = ORDERED_ITEM_PATTERN.exec(line);
    if (ordered || UNORDERED_ITEM_PATTERN.test(line)) {
      const itemPattern = ordered ? ORDERED_ITEM_PATTERN : UNORDERED_ITEM_PATTERN;
      const items: string[] = [];
      while (index < lines.length) {
        const item = itemPattern.exec(lines[index]);
        if (item) {
          items.push(item[item.length - 1]);
        } else if (items.length > 0 && CONTINUATION_PATTERN.test(lines[index])) {
          items[items.length - 1] += `\n${lines[index].trim()}`;
        } else {
          break;
        }
        index += 1;
      }
      blocks.push({
        kind: "list",
        ordered: Boolean(ordered),
        start: ordered ? Number(ordered[1]) : 1,
        items: items.map((item) => parseInline(item)),
      });
      continue;
    }
    const paragraphLines = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim() !== "" && !isBlockStart(lines[index])) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ kind: "paragraph", children: parseInline(paragraphLines.join("\n")) });
  }
  return blocks;
}

const ELLIPSIS = "…";

function truncateInlines(nodes: MarkdownInline[], budget: number): { nodes: MarkdownInline[]; used: number } {
  const kept: MarkdownInline[] = [];
  let used = 0;
  for (const node of nodes) {
    const remaining = budget - used;
    if (remaining <= 0) break;
    if (node.kind === "text" || node.kind === "code") {
      const characters = Array.from(node.text);
      if (characters.length <= remaining) {
        kept.push(node);
        used += characters.length;
      } else {
        kept.push({ ...node, text: characters.slice(0, remaining).join("") + ELLIPSIS });
        used = budget;
      }
      continue;
    }
    const inner = truncateInlines(node.children, remaining);
    kept.push({ ...node, children: inner.nodes });
    used += inner.used;
  }
  return { nodes: kept, used };
}

export function excerptBlocks(blocks: MarkdownBlock[], maxCharacters: number): MarkdownBlock[] {
  const kept: MarkdownBlock[] = [];
  let used = 0;
  for (const block of blocks) {
    const remaining = maxCharacters - used;
    if (remaining <= 0) break;
    if (block.kind === "codeBlock") {
      const characters = Array.from(block.text);
      const fits = characters.length <= remaining;
      kept.push(fits ? block : { ...block, text: characters.slice(0, remaining).join("") + ELLIPSIS });
      used += fits ? characters.length : remaining;
      continue;
    }
    if (block.kind === "list") {
      const items: MarkdownInline[][] = [];
      for (const item of block.items) {
        if (used >= maxCharacters) break;
        const truncated = truncateInlines(item, maxCharacters - used);
        items.push(truncated.nodes);
        used += truncated.used;
      }
      kept.push({ ...block, items });
      continue;
    }
    const truncated = truncateInlines(block.children, remaining);
    kept.push({ ...block, children: truncated.nodes });
    used += truncated.used;
  }
  return kept;
}
