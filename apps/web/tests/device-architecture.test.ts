import assert from "node:assert/strict";
import type { Dirent } from "node:fs";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { MOBILE_SPLIT_ROUTES } from "../src/lib/device.ts";

const SRC_ROOT = join(import.meta.dirname, "..", "src");
const DESKTOP_TREE = join(SRC_ROOT, "app/(desktop)");
const MOBILE_TREE = join(SRC_ROOT, "app/m");
const DESKTOP_COMPONENTS = join(SRC_ROOT, "components/desktop");
const MOBILE_COMPONENTS = join(SRC_ROOT, "components/mobile");

function listFiles(dir: string): string[] {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((entry): string[] => {
    const entryPath = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  });
}

function codeFiles(files: string[]): string[] {
  return files.filter((file) => /\.(ts|tsx)$/.test(file));
}

function importSpecifiers(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const staticSpecifiers = [...source.matchAll(/(?:import|export)\s[^"']*?from\s*"([^"]+)"/g)].map(
    (match) => match[1] ?? "",
  );
  const dynamicSpecifiers = [...source.matchAll(/import\(\s*"([^"]+)"\s*\)/g)].map((match) => match[1] ?? "");
  return [...staticSpecifiers, ...dynamicSpecifiers].filter((specifier) => specifier !== "");
}

function routeForPageFile(file: string, treeRoot: string): string {
  const relative = file.slice(treeRoot.length).replace(/\/page\.tsx$/, "");
  return relative === "" ? "/" : relative;
}

test("desktop and mobile page trees match the split route registry", () => {
  const desktopRoutes = codeFiles(listFiles(DESKTOP_TREE))
    .filter((file) => file.endsWith("page.tsx"))
    .map((file) => routeForPageFile(file, DESKTOP_TREE))
    .sort();
  const mobileRoutes = codeFiles(listFiles(MOBILE_TREE))
    .filter((file) => file.endsWith("page.tsx"))
    .map((file) => routeForPageFile(file, MOBILE_TREE))
    .sort();
  assert.deepEqual(desktopRoutes, [...MOBILE_SPLIT_ROUTES].sort(), "desktop tree routes");
  assert.deepEqual(mobileRoutes, [...MOBILE_SPLIT_ROUTES].sort(), "mobile tree routes");
});

test("desktop tree never imports mobile modules", () => {
  const violations: string[] = [];
  for (const file of codeFiles([...listFiles(DESKTOP_TREE), ...listFiles(DESKTOP_COMPONENTS)])) {
    for (const specifier of importSpecifiers(file)) {
      if (/components\/mobile\//.test(specifier)) {
        violations.push(`${file} imports ${specifier}`);
      }
    }
  }
  assert.deepEqual(violations, []);
});

test("mobile tree never imports desktop modules", () => {
  const violations: string[] = [];
  for (const file of codeFiles([...listFiles(MOBILE_TREE), ...listFiles(MOBILE_COMPONENTS)])) {
    for (const specifier of importSpecifiers(file)) {
      if (/components\/desktop\//.test(specifier)) {
        violations.push(`${file} imports ${specifier}`);
      }
    }
  }
  assert.deepEqual(violations, []);
});

test("shared code never imports device-specific modules", () => {
  const deviceDirPattern = /components\/(desktop|mobile)\//;
  const sharedFiles = codeFiles(
    [...listFiles(SRC_ROOT)].filter(
      (file) =>
        !file.startsWith(DESKTOP_TREE) &&
        !file.startsWith(MOBILE_TREE) &&
        !file.startsWith(DESKTOP_COMPONENTS) &&
        !file.startsWith(MOBILE_COMPONENTS),
    ),
  );
  const violations: string[] = [];
  for (const file of sharedFiles) {
    for (const specifier of importSpecifiers(file)) {
      if (deviceDirPattern.test(specifier)) {
        violations.push(`${file} imports ${specifier}`);
      }
    }
  }
  assert.deepEqual(violations, []);
});
