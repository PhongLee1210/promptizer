import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCase, extensionId } from "../harness.mjs";
import { createAdminClient } from "../../../web/src/lib/server/supabase.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.resolve(__dirname, "../../../web");
const WEB_PORT = Number(process.env.WEB_PORT ?? 3303);
const WEB_ORIGIN = `http://localhost:${WEB_PORT}`;
const SERVER_READY_TIMEOUT_MS = 30_000;
const SERVER_POLL_INTERVAL_MS = 300;
const UI_TIMEOUT_MS = 8000;
const LINK_EMAIL_PREFIX = "promptizer-e2e-link-";
const INITIAL_PASSWORD = "correct-horse-battery";
const CHANGED_PASSWORD = "staple-battery-horse";
const WRONG_PASSWORD = "definitely-not-it-123";
const CLIENT_KIND_HEADER = "X-Promptizer-Client";
const EXTENSION_CLIENT_KIND = "extension";
const SESSION_STORAGE_KEY = "promptizer.accountSession";
const LIBRARY_STORAGE_KEY = "promptizer.librarySnapshot";
const PICKER_SETTLE_MS = 200;
const SYNC_TITLE = "Sync link original";
const SYNC_TEXT = "Sync link original text";
const EXTENSION_EDITED_TITLE = "Edited in the extension";
const WEB_EDITED_TEXT = "Rewritten on the dashboard";
const PROMPT_ID_IN_PATH = /^\/prompts\/([0-9a-f-]{36})$/;
const USER_NAME = "Link Tester";
const email = `${LINK_EMAIL_PREFIX}${Date.now()}@example.com`;

function startWebServer() {
  return spawn("pnpm", ["exec", "next", "start", "-p", String(WEB_PORT)], {
    cwd: WEB_DIR,
    env: { ...process.env, EXTENSION_ORIGIN: `chrome-extension://${extensionId()}` },
    stdio: ["ignore", "ignore", "inherit"],
    detached: true,
  });
}

function stopWebServer(server) {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill("SIGTERM");
  }
}

async function waitForWebServer() {
  const deadline = Date.now() + SERVER_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${WEB_ORIGIN}/api/health`)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, SERVER_POLL_INTERVAL_MS));
  }
  throw new Error("web app did not become ready");
}

async function removeLinkUsers() {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const leftovers = data.users.filter((user) => user.email?.startsWith(LINK_EMAIL_PREFIX));
  await Promise.all(leftovers.map((user) => admin.auth.admin.deleteUser(user.id)));
  return leftovers.length;
}

async function waitForText(page, text) {
  await page.waitForFunction(
    (expected) => document.body.innerText.includes(expected),
    { timeout: UI_TIMEOUT_MS },
    text,
  );
}

async function waitForPath(page, expected) {
  await page.waitForFunction((target) => location.pathname === target, { timeout: UI_TIMEOUT_MS }, expected);
}

async function fillField(page, label, value) {
  const input = await page.waitForSelector(`aria/${label}`, { timeout: UI_TIMEOUT_MS });
  await input.evaluate((field) => field.select());
  await input.type(value);
}

async function press(page, name) {
  await (await page.waitForSelector(`aria/${name}[role="button"]`, { timeout: UI_TIMEOUT_MS })).click();
}

async function registerOnWeb(page) {
  await page.goto(`${WEB_ORIGIN}/sign-up`, { waitUntil: "networkidle0" });
  await fillField(page, "Name", USER_NAME);
  await fillField(page, "Email", email);
  await fillField(page, "Password", INITIAL_PASSWORD);
  await press(page, "Create account");
  await waitForPath(page, "/prompts");
  await waitForText(page, "All prompts");
}

async function changePasswordOnWeb(page) {
  await page.bringToFront();
  await page.goto(`${WEB_ORIGIN}/account/password`, { waitUntil: "networkidle0" });
  await fillField(page, "Current password", INITIAL_PASSWORD);
  await fillField(page, "New password", CHANGED_PASSWORD);
  await fillField(page, "Confirm new password", CHANGED_PASSWORD);
  await press(page, "Change password");
  await waitForText(page, "Your password has been changed.");
}

async function openAccountScreen(browser) {
  const popup = await browser.newPage();
  await popup.goto(`chrome-extension://${extensionId()}/popup.html`, { waitUntil: "networkidle0" });
  await (await popup.waitForSelector("aria/Account", { timeout: UI_TIMEOUT_MS })).click();
  return popup;
}

async function signInOnExtension(popup, password) {
  await fillField(popup, "Email", email);
  await fillField(popup, "Password", password);
  await press(popup, "Sign in");
}

async function createPromptOnWeb(page) {
  await page.bringToFront();
  await page.goto(`${WEB_ORIGIN}/prompts/new`, { waitUntil: "networkidle0" });
  await fillField(page, "Title", SYNC_TITLE);
  await fillField(page, "Prompt text", SYNC_TEXT);
  await press(page, "Save prompt");
  await page.waitForFunction(
    (pattern) => new RegExp(pattern).test(location.pathname),
    { timeout: UI_TIMEOUT_MS },
    PROMPT_ID_IN_PATH.source,
  );
  return new URL(page.url()).pathname.match(PROMPT_ID_IN_PATH)[1];
}

async function rewriteTextOnWeb(page, promptId) {
  await page.bringToFront();
  await page.goto(`${WEB_ORIGIN}/prompts/${promptId}/edit`, { waitUntil: "networkidle0" });
  await page.$eval("#prompt-text", (field) => field.select());
  await page.type("#prompt-text", WEB_EDITED_TEXT);
  await page.waitForFunction(
    () => document.querySelector('[data-testid="save-status"]')?.textContent?.startsWith("Saved"),
    { timeout: UI_TIMEOUT_MS },
  );
}

async function webPromptPageShows(page, promptId, text) {
  await page.bringToFront();
  await page.goto(`${WEB_ORIGIN}/prompts/${promptId}`, { waitUntil: "networkidle0" });
  return (await page.$eval("main", (main) => main.innerText)).includes(text);
}

async function refreshLibraryUntilCached(popup, promptId, expectedText) {
  await popup.bringToFront();
  await press(popup, "Refresh");
  await popup.waitForFunction(
    async (key, id, text) =>
      (await chrome.storage.local.get(key))[key]?.prompts?.some((prompt) => prompt.id === id && prompt.text === text),
    { timeout: UI_TIMEOUT_MS },
    LIBRARY_STORAGE_KEY,
    promptId,
    expectedText,
  );
}

async function cachedPrompt(popup, promptId) {
  return popup.evaluate(
    async (key, id) => (await chrome.storage.local.get(key))[key]?.prompts?.find((prompt) => prompt.id === id) ?? null,
    LIBRARY_STORAGE_KEY,
    promptId,
  );
}

async function serverPromptFromExtension(popup, accessToken, promptId) {
  return popup.evaluate(
    async (origin, token, id, clientHeader, clientKind) => {
      const response = await fetch(`${origin}/api/prompts/${id}`, {
        headers: { Authorization: `Bearer ${token}`, [clientHeader]: clientKind },
      });
      return response.status === 404 ? null : { status: response.status, ...(await response.json()) };
    },
    WEB_ORIGIN,
    accessToken,
    promptId,
    CLIENT_KIND_HEADER,
    EXTENSION_CLIENT_KIND,
  );
}

async function cacheAgreesWithAccount(popup, accessToken, promptId) {
  const [cached, server] = await Promise.all([
    cachedPrompt(popup, promptId),
    serverPromptFromExtension(popup, accessToken, promptId),
  ]);
  const agrees =
    cached === null || server === null
      ? cached === server
      : server.status === 200 && cached.title === server.title && cached.text === server.text;
  return { agrees, detail: JSON.stringify({ cached: cached?.title ?? null, server: server?.title ?? null }) };
}

async function openPicker(page) {
  await page.bringToFront();
  await page.click("#composer");
  await new Promise((resolve) => setTimeout(resolve, PICKER_SETTLE_MS));
  await (await page.waitForSelector("aria/Promptizer actions", { timeout: UI_TIMEOUT_MS })).click();
  await new Promise((resolve) => setTimeout(resolve, PICKER_SETTLE_MS));
  await (await page.waitForSelector("aria/My Prompts", { timeout: UI_TIMEOUT_MS })).click();
  await page.waitForSelector("aria/Search prompts", { timeout: UI_TIMEOUT_MS });
}

async function closePicker(page) {
  await page.keyboard.press("Escape");
  await new Promise((resolve) => setTimeout(resolve, PICKER_SETTLE_MS));
}

async function openPickerEditor(page, query) {
  await openPicker(page);
  await page.keyboard.type(query);
  await (await page.waitForSelector('aria/Edit selected prompt[role="button"]', { timeout: UI_TIMEOUT_MS })).click();
  return page.waitForSelector('aria/Prompt title[role="textbox"]', { timeout: UI_TIMEOUT_MS });
}

async function editTitleInPicker(page, query, title) {
  const titleField = await openPickerEditor(page, query);
  await titleField.evaluate((input) => input.select());
  await page.keyboard.type(title);
  await press(page, "Save changes");
  await page.waitForSelector(`aria/${title}`, { timeout: UI_TIMEOUT_MS });
  await closePicker(page);
}

async function pickerEditorText(page, query) {
  await openPickerEditor(page, query);
  const text = await (await page.waitForSelector('aria/Prompt text[role="textbox"]')).evaluate((area) => area.value);
  await press(page, "Cancel edit");
  await closePicker(page);
  return text;
}

async function deleteInPicker(page, query) {
  await openPicker(page);
  await page.keyboard.type(query);
  await press(page, "Delete selected prompt");
  await press(page, "Delete prompt");
  await page.waitForSelector(`aria/${query}`, { hidden: true, timeout: UI_TIMEOUT_MS });
  await closePicker(page);
}

async function storedAccessToken(popup) {
  return popup.evaluate(async (key) => (await chrome.storage.local.get(key))[key]?.accessToken, SESSION_STORAGE_KEY);
}

async function meStatusFromExtension(popup, accessToken) {
  return popup.evaluate(
    async (origin, token, clientHeader, clientKind) => {
      const response = await fetch(`${origin}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}`, [clientHeader]: clientKind },
      });
      return response.status;
    },
    WEB_ORIGIN,
    accessToken,
    CLIENT_KIND_HEADER,
    EXTENSION_CLIENT_KIND,
  );
}

await removeLinkUsers();
const webServer = startWebServer();
try {
  await waitForWebServer();
  await runCase("web-link", async (fixturePage, check, browser) => {
    const web = await browser.newPage();
    await registerOnWeb(web);
    check("account created on the web app lands signed in", true);

    let popup = await openAccountScreen(browser);
    await waitForText(popup, "Use your Promptizer account");
    await signInOnExtension(popup, WRONG_PASSWORD);
    await waitForText(popup, "Email or password is incorrect");
    check("extension rejects wrong credentials from the real server", true);

    await signInOnExtension(popup, INITIAL_PASSWORD);
    await waitForText(popup, email);
    await waitForText(popup, USER_NAME);
    check("extension signs in with the account created on the web app", true);

    const firstToken = await storedAccessToken(popup);
    check(
      "extension bearer token is accepted by the web app",
      (await meStatusFromExtension(popup, firstToken)) === 200,
    );

    await popup.close();
    popup = await openAccountScreen(browser);
    await waitForText(popup, email);
    check("reopening the popup keeps the extension signed in", true);

    await changePasswordOnWeb(web);
    check("password changed on the web app", true);
    check(
      "web password change revokes the extension session on the server",
      (await meStatusFromExtension(popup, firstToken)) === 401,
    );

    await popup.close();
    popup = await openAccountScreen(browser);
    await waitForText(popup, "Use your Promptizer account");
    check("extension shows signed out after the session was revoked", true);

    await signInOnExtension(popup, INITIAL_PASSWORD);
    await waitForText(popup, "Email or password is incorrect");
    check("old password no longer signs in on the extension", true);

    await signInOnExtension(popup, CHANGED_PASSWORD);
    await waitForText(popup, email);
    const secondToken = await storedAccessToken(popup);
    check("new password signs in on the extension", (await meStatusFromExtension(popup, secondToken)) === 200);

    const syncedId = await createPromptOnWeb(web);
    await refreshLibraryUntilCached(popup, syncedId, SYNC_TEXT);
    let agreement = await cacheAgreesWithAccount(popup, secondToken, syncedId);
    check(
      "a prompt created on the dashboard reaches the extension cache after refresh",
      agreement.agrees,
      agreement.detail,
    );

    await editTitleInPicker(fixturePage, SYNC_TITLE, EXTENSION_EDITED_TITLE);
    check(
      "an edit made in the extension picker is visible on the dashboard",
      await webPromptPageShows(web, syncedId, EXTENSION_EDITED_TITLE),
    );
    agreement = await cacheAgreesWithAccount(popup, secondToken, syncedId);
    check("cache and account agree after the extension edit", agreement.agrees, agreement.detail);

    await rewriteTextOnWeb(web, syncedId);
    await refreshLibraryUntilCached(popup, syncedId, WEB_EDITED_TEXT);
    check(
      "a dashboard edit is visible in the extension picker after refresh",
      (await pickerEditorText(fixturePage, EXTENSION_EDITED_TITLE)) === WEB_EDITED_TEXT,
    );
    agreement = await cacheAgreesWithAccount(popup, secondToken, syncedId);
    check("cache and account agree after the dashboard edit and refresh", agreement.agrees, agreement.detail);

    await deleteInPicker(fixturePage, EXTENSION_EDITED_TITLE);
    agreement = await cacheAgreesWithAccount(popup, secondToken, syncedId);
    check(
      "a delete from the extension removes the prompt from both cache and account",
      agreement.agrees && (await cachedPrompt(popup, syncedId)) === null,
      agreement.detail,
    );

    await press(popup, "Sign out");
    await waitForText(popup, "Use your Promptizer account");
    check(
      "extension sign-out revokes its token on the server",
      (await meStatusFromExtension(popup, secondToken)) === 401,
    );

    await web.goto(`${WEB_ORIGIN}/prompts`, { waitUntil: "networkidle0" });
    await waitForText(web, "All prompts");
    check("extension sign-out leaves the web app session intact", new URL(web.url()).pathname === "/prompts");
  });
} finally {
  stopWebServer(webServer);
  console.log(`cleanup removed ${await removeLinkUsers()} user(s)`);
}
