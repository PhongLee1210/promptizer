import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const EXT_PATH = path.join(ROOT, ".output/chrome-mv3");
const FIXTURE_DIR = path.join(__dirname, "fixture");
export const PORT = 4173;
export const ORIGINAL_PROMPT = "make contact button sticky but dont change existing design";

function startServer() {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(fs.readFileSync(path.join(FIXTURE_DIR, "index.html")));
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}

function stopServer(server) {
  return new Promise((resolve) => {
    server.closeAllConnections();
    server.close(resolve);
  });
}

// GitHub's Ubuntu runners disable unprivileged user namespaces through AppArmor,
// so Chrome's zygote sandbox cannot start there.
const SANDBOX_ARGS = process.env.CI ? ["--no-sandbox", "--disable-setuid-sandbox"] : [];

// Runs one test case: launches real Chrome with the built extension, opens the
// local fixture (content script only matches it because wxt.config.ts +
// content.ts temporarily add http://127.0.0.1:4173/* before `pnpm build` —
// see e2e/README.md), and tears everything down after.
export async function runCase(name, fn) {
  const results = [];
  const check = (label, pass, detail = "") => {
    results.push({ label, pass, detail });
    console.log(`${pass ? "PASS" : "FAIL"} - ${label}${detail ? ` (${detail})` : ""}`);
  };

  const server = await startServer();
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: false,
      args: [
        `--disable-extensions-except=${EXT_PATH}`,
        `--load-extension=${EXT_PATH}`,
        "--window-size=1000,800",
        ...SANDBOX_ARGS,
      ],
      defaultViewport: null,
      ignoreDefaultArgs: ["--disable-extensions"],
    });
    await new Promise((r) => setTimeout(r, 1000));
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle0" });
    await page.waitForFunction(() => document.documentElement.hasAttribute("data-promptizer-active"), {
      timeout: 5000,
    });
    await fn(page, check, browser);
  } finally {
    await browser?.close();
    await stopServer(server);
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`[${name}] ${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

export async function focusAndType(page, text = ORIGINAL_PROMPT) {
  await page.click("#composer");
  await page.type("#composer", text);
}

export async function openRailOnRefine(page) {
  const chip = await page.waitForSelector("aria/Promptizer actions", { timeout: 5000 });
  await chip.click();
  const refineLeaf = await page.waitForSelector("aria/Refine prompt", { timeout: 5000 });
  await new Promise((r) => setTimeout(r, 200)); // let the rail-open animation settle
  return refineLeaf;
}

// Chrome derives an unpacked extension's id deterministically from its absolute
// install path (sha256 of the path, first 16 bytes, nibbles mapped to a-p) since
// MV3 extensions without a background entrypoint never expose a service-worker
// target to discover the id from.
export function extensionId() {
  const hash = crypto.createHash("sha256").update(EXT_PATH).digest();
  const hex = hash.toString("hex").slice(0, 32);
  return hex
    .split("")
    .map((nibble) => String.fromCharCode(97 + Number.parseInt(nibble, 16)))
    .join("");
}

export function findAccessibleName(node, predicate) {
  if (node === undefined || node === null) {
    return null;
  }
  if (typeof node.name === "string" && predicate(node.name)) {
    return node.name;
  }
  for (const child of node.children ?? []) {
    const found = findAccessibleName(child, predicate);
    if (found !== null) {
      return found;
    }
  }
  return null;
}
