import assert from "node:assert/strict";
import { test } from "node:test";
import { Fragment, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { excerptBlocks, parseInline, parseMarkdown, safeHref } from "../src/lib/prompts/markdown.ts";
import { renderMarkdown } from "../src/lib/prompts/markdown-render.ts";
import type { MarkdownRenderOptions } from "../src/lib/prompts/markdown-render.ts";

function toHtml(source: string, options?: MarkdownRenderOptions): string {
  return renderToStaticMarkup(createElement(Fragment, null, renderMarkdown(source, options)));
}

test("headings render one level below the page title and seven hashes stay text", () => {
  assert.equal(toHtml("# One\n## Two\n###### Six ##"), "<h2>One</h2><h3>Two</h3><h6>Six</h6>");
  assert.equal(toHtml("####### Seven"), "<p>####### Seven</p>");
  assert.equal(toHtml("#NoSpace"), "<p>#NoSpace</p>");
});

test("headings render as bold paragraphs when shown as text", () => {
  assert.equal(toHtml("# Goal\nBody", { headingsAsText: true }), "<p><strong>Goal</strong></p><p>Body</p>");
});

test("lists keep their kind and ordered start number", () => {
  assert.equal(toHtml("- a\n- b"), "<ul><li>a</li><li>b</li></ul>");
  assert.equal(toHtml("3. c\n4. d"), '<ol start="3"><li>c</li><li>d</li></ol>');
  assert.equal(toHtml("1. x\n   continued"), "<ol><li>x\ncontinued</li></ol>");
});

test("fenced code keeps its text verbatim, records the language and runs to the end when unclosed", () => {
  assert.equal(
    toHtml("```ts\nconst a = '<b>';\n```"),
    '<pre><code data-language="ts">const a = &#x27;&lt;b&gt;&#x27;;</code></pre>',
  );
  assert.deepEqual(parseMarkdown("```\nopen\n**not bold**"), [
    { kind: "codeBlock", language: "", text: "open\n**not bold**" },
  ]);
});

test("inline emphasis, strong, nesting and code spans", () => {
  assert.equal(toHtml("**bold** and *em* and _em2_"), "<p><strong>bold</strong> and <em>em</em> and <em>em2</em></p>");
  assert.equal(toHtml("**bold *inner* text**"), "<p><strong>bold <em>inner</em> text</strong></p>");
  assert.equal(toHtml("`a * b`"), "<p><code>a * b</code></p>");
  assert.equal(toHtml("snake_case_name"), "<p>snake_case_name</p>");
  assert.equal(toHtml("\\*literal\\*"), "<p>*literal*</p>");
});

test("safe links render with rel and target, unsafe links stay text", () => {
  assert.equal(
    toHtml("[site](https://example.com/a?b=1)"),
    '<p><a href="https://example.com/a?b=1" rel="noopener noreferrer nofollow" target="_blank">site</a></p>',
  );
  assert.match(toHtml("[mail](mailto:ada@example.com)"), /<a href="mailto:ada@example.com"/);
  for (const hostile of [
    "[x](javascript:alert(1))",
    "[x](data:text/html,hi)",
    "[x](//evil.example)",
    "[x](/relative)",
  ]) {
    const html = toHtml(hostile);
    assert.doesNotMatch(html, /<a /, hostile);
  }
  assert.equal(safeHref(" JAVASCRIPT:alert(1)"), undefined);
});

test("raw HTML is rendered as escaped text, never markup", () => {
  const html = toHtml(
    '<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n<a href="javascript:alert(1)">x</a>',
  );
  assert.doesNotMatch(html, /<script|<img|<a /);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
});

test("hostile repetition parses in linear time without throwing", () => {
  for (const hostile of [
    "*".repeat(50_000),
    "[".repeat(50_000),
    "`".repeat(50_000),
    "_a".repeat(25_000),
    "[a](".repeat(12_500),
  ]) {
    const started = performance.now();
    toHtml(hostile);
    assert.ok(performance.now() - started < 200, `${hostile.slice(0, 4)} took too long`);
  }
});

test("deep nesting is capped and the remainder stays text", () => {
  const nested = `${"*_".repeat(20)}x${"_*".repeat(20)}`;
  assert.doesNotThrow(() => parseInline(nested));
  let depth = 0;
  let nodes = parseInline("*a _b *c _d *e _f *g _h *i _j*_*_*_*_*_*_*");
  while (nodes.some((node) => node.kind === "emphasis")) {
    const emphasis = nodes.find((node) => node.kind === "emphasis");
    nodes = emphasis && emphasis.kind === "emphasis" ? emphasis.children : [];
    depth += 1;
  }
  assert.ok(depth <= 8);
});

test("links can render as plain text inside other links and excerpts truncate", () => {
  assert.equal(toHtml("[site](https://example.com)", { linksAsText: true }), "<p><span>site</span></p>");
  const blocks = excerptBlocks(parseMarkdown("# Title\n\nabcdefghij\n\nnever shown"), 8);
  assert.deepEqual(blocks, [
    { kind: "heading", level: 1, children: [{ kind: "text", text: "Title" }] },
    { kind: "paragraph", children: [{ kind: "text", text: "abc…" }] },
  ]);
  assert.equal(toHtml("abcdefghij", { maxCharacters: 4 }), "<p>abcd…</p>");
});
