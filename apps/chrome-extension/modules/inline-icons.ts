import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { defineWxtModule } from "wxt/modules";

const sourceDir = "src/assets/icon-sources";
const outputPath = "src/utils/icons.ts";

function inlineSvg(markup: string): string {
  const source = markup.trim();
  const openTag = /^<svg[^>]*>/.exec(source);
  if (openTag === null) {
    throw new Error("inline-icons: markup does not start with an <svg> element");
  }
  const cleaned = openTag[0].replace(/\s+(?:width|height)="[^"]*"/g, "").replace(/^<svg/, '<svg aria-hidden="true"');
  return cleaned + source.slice(openTag[0].length);
}

function render(root: string): string {
  const dir = resolve(root, sourceDir);
  const inlinable = readdirSync(dir)
    .filter((file) => file.endsWith(".svg"))
    .sort()
    .map((file) => ({ name: file.slice(0, -".svg".length), source: readFileSync(join(dir, file), "utf8") }))
    .filter(({ source }) => source.includes("currentColor"));
  if (inlinable.length === 0) {
    throw new Error(`inline-icons: no svg files using currentColor found in ${dir}`);
  }
  const union = inlinable.map(({ name }) => `  | ${JSON.stringify(name)}`).join("\n");
  const entries = inlinable
    .map(({ name, source }) => `  ${JSON.stringify(name)}: ${JSON.stringify(inlineSvg(source))}`)
    .join(",\n");
  return [
    `export type IconName =`,
    `${union};`,
    ``,
    `export const icons: Record<IconName, string> = {`,
    `${entries}`,
    `};`,
    ``,
    `export function icon(name: IconName, size = 24): string {`,
    `  return icons[name].replace("<svg", \`<svg width="\${size}" height="\${size}"\`);`,
    `}`,
    ``,
  ].join("\n");
}

function generate(root: string): void {
  const contents = render(root);
  const target = resolve(root, outputPath);
  if (existsSync(target) && readFileSync(target, "utf8") === contents) {
    return;
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents, "utf8");
}

export default defineWxtModule({
  name: "inline-icons",
  setup(wxt) {
    generate(wxt.config.root);
    wxt.hooks.hook("prepare:types", () => {
      generate(wxt.config.root);
    });
    wxt.hooks.hook("build:before", () => {
      generate(wxt.config.root);
    });
  },
});
