import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import puppeteer from "puppeteer";
import { createAdminClient } from "../src/lib/server/supabase.ts";

const PORT = 3301;
const BASE_URL = `http://localhost:${PORT}`;
const E2E_EMAIL_PREFIX = "promptizer-e2e-";
const ACCESS_COOKIE = "promptizer_access";
const ACCOUNT_NAME = "Ada E2E";
const INITIAL_PASSWORD = "correct-horse-battery";
const CHANGED_PASSWORD = "staple-battery-horse";
const WRONG_PASSWORD = "definitely-not-it-123";
const SHORT_PASSWORD = "short";
const SERVER_READY_TIMEOUT_MS = 60000;
const UI_TIMEOUT_MS = 15000;
const SERVER_POLL_INTERVAL_MS = 500;
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
const SIGNED_IN_LANDING_PATH = "/prompts";
const SANDBOX_ARGS = process.env.CI ? ["--no-sandbox", "--disable-setuid-sandbox"] : [];

const email = `${E2E_EMAIL_PREFIX}${crypto.randomUUID()}@example.com`;
const failures = [];

function check(label, pass, detail = "") {
  console.log(`${pass ? "PASS" : "FAIL"} - ${label}${detail ? ` (${detail})` : ""}`);
  if (!pass) {
    failures.push(label);
  }
}

async function journey(name, run) {
  try {
    await run();
  } catch (error) {
    check(`${name} completed`, false, error instanceof Error ? error.message : String(error));
  }
}

function startServer() {
  const server = spawn("pnpm", ["exec", "next", "start", "-p", String(PORT)], {
    stdio: ["ignore", "ignore", "inherit"],
    detached: true,
  });
  return server;
}

function stopServer(server) {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill("SIGTERM");
  }
}

async function waitForServer() {
  const deadline = Date.now() + SERVER_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      if (response.ok) {
        return;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, SERVER_POLL_INTERVAL_MS));
  }
  throw new Error("Server did not become ready");
}

async function removeE2eUsers() {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    throw error;
  }
  const leftovers = data.users.filter((user) => user.email?.startsWith(E2E_EMAIL_PREFIX));
  await Promise.all(leftovers.map((user) => admin.auth.admin.deleteUser(user.id)));
  return leftovers.length;
}

async function visibleText(page) {
  return page.evaluate(() => document.body.innerText);
}

async function waitForText(page, text) {
  await page.waitForFunction(
    (expected) => document.body.innerText.includes(expected),
    { timeout: UI_TIMEOUT_MS },
    text,
  );
}

async function waitForPath(page, pathAndQuery) {
  try {
    await page.waitForFunction(
      (expected) => location.pathname + location.search === expected,
      { timeout: UI_TIMEOUT_MS },
      pathAndQuery,
    );
  } catch (error) {
    const visible = (await visibleText(page)).replace(/\n/g, " | ").slice(0, 200);
    throw new Error(`expected ${pathAndQuery} but at ${await currentPathAndQuery(page)}: ${visible}`, { cause: error });
  }
}

async function currentPathAndQuery(page) {
  const url = new URL(page.url());
  return url.pathname + url.search;
}

async function fillField(page, label, value) {
  const input = await page.waitForSelector(`aria/${label}`, { timeout: UI_TIMEOUT_MS });
  await input.evaluate((field) => field.select());
  await input.type(value);
}

async function submit(page, buttonName) {
  const button = await page.waitForSelector(`aria/${buttonName}[role="button"]`, { timeout: UI_TIMEOUT_MS });
  await button.click();
}

async function signInViaUi(page, password) {
  await fillField(page, "Email", email);
  await fillField(page, "Password", password);
  await submit(page, "Sign in");
}

async function clickByAccessibleName(page, pattern) {
  return page.evaluate((source) => {
    const matcher = new RegExp(source, "i");
    const candidates = [...document.querySelectorAll("button, a, [role=menuitem], [role=button]")];
    const target = candidates.find((node) => matcher.test(node.getAttribute("aria-label") ?? node.textContent ?? ""));
    target?.click();
    return Boolean(target);
  }, pattern);
}

async function signOutViaUi(page) {
  const menuTrigger = await page.waitForSelector('button[aria-label^="Account menu"]', {
    visible: true,
    timeout: UI_TIMEOUT_MS,
  });
  await menuTrigger.click();
  await page.waitForFunction(() => /sign out/i.test(document.body.innerText), { timeout: UI_TIMEOUT_MS });
  assert.ok(await clickByAccessibleName(page, "sign out"), "no Sign out control found");
  await page.waitForFunction(() => location.pathname === "/sign-in", { timeout: UI_TIMEOUT_MS });
}

async function anonymousJourney(page) {
  await page.goto(`${BASE_URL}/account/password`);
  check(
    "anonymous /account/password redirects with return-to",
    (await currentPathAndQuery(page)) === "/sign-in?next=%2Faccount%2Fpassword",
    await currentPathAndQuery(page),
  );
  await page.goto(`${BASE_URL}/examples/default`);
  check(
    "anonymous examples page redirects to sign-in",
    (await currentPathAndQuery(page)).startsWith("/sign-in?next="),
    await currentPathAndQuery(page),
  );
  await page.goto(`${BASE_URL}/sign-up`);
  check("sign-up page is reachable anonymously", (await currentPathAndQuery(page)) === "/sign-up");
}

async function registrationJourney(page) {
  await page.goto(`${BASE_URL}/sign-up`);
  await fillField(page, "Name", ACCOUNT_NAME);
  await fillField(page, "Email", email);
  await fillField(page, "Password", SHORT_PASSWORD);
  await submit(page, "Create account");
  await page.waitForSelector('[data-slot="field-error"], [role="alert"], [data-invalid]', { timeout: UI_TIMEOUT_MS });
  const invalidFieldText = await page.evaluate(() => {
    const passwordInput = document.querySelector('input[name="password"]');
    return passwordInput?.closest('[data-slot="field"]')?.innerText ?? "";
  });
  check(
    "short password error is shown next to the password field",
    /password/i.test(invalidFieldText) && invalidFieldText.trim().split("\n").length > 1,
    invalidFieldText.replace(/\n/g, " | "),
  );
  check("short password stays on sign-up", (await currentPathAndQuery(page)) === "/sign-up");

  await fillField(page, "Password", INITIAL_PASSWORD);
  await submit(page, "Create account");
  await waitForPath(page, SIGNED_IN_LANDING_PATH);
  await waitForText(page, ACCOUNT_NAME);
  check("registration lands signed in on dashboard home showing the name", true);
}

async function duplicateRegistrationJourney(browser) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  try {
    await page.goto(`${BASE_URL}/sign-up`);
    await fillField(page, "Name", ACCOUNT_NAME);
    await fillField(page, "Email", email);
    await fillField(page, "Password", INITIAL_PASSWORD);
    await submit(page, "Create account");
    await page.waitForFunction(() => document.querySelector('[role="alert"], [data-slot="field-error"]'), {
      timeout: UI_TIMEOUT_MS,
    });
    const text = await visibleText(page);
    check(
      "duplicate email shows a friendly inline message",
      /already|can't|cannot|try signing in/i.test(text) && !/error:|exception|duplicate key/i.test(text),
      text.replace(/\n/g, " | ").slice(0, 200),
    );
    check("duplicate email stays on sign-up", (await currentPathAndQuery(page)) === "/sign-up");
  } finally {
    await context.close();
  }
}

async function guardedAuthPagesAndSignInJourney(page) {
  await page.goto(`${BASE_URL}/sign-in`);
  check(
    "signed-in user is redirected away from /sign-in",
    (await currentPathAndQuery(page)) === SIGNED_IN_LANDING_PATH,
    await currentPathAndQuery(page),
  );
  await page.goto(`${BASE_URL}/sign-up`);
  check(
    "signed-in user is redirected away from /sign-up",
    (await currentPathAndQuery(page)) === SIGNED_IN_LANDING_PATH,
    await currentPathAndQuery(page),
  );
  await signOutViaUi(page);

  await page.goto(`${BASE_URL}/sign-in`);
  await signInViaUi(page, WRONG_PASSWORD);
  await page.waitForSelector('[role="alert"]', { timeout: UI_TIMEOUT_MS });
  check(
    "wrong password shows an inline error and stays on sign-in",
    (await currentPathAndQuery(page)) === "/sign-in" && /invalid|incorrect|wrong|match/i.test(await visibleText(page)),
    (await visibleText(page)).replace(/\n/g, " | ").slice(0, 160),
  );

  await page.goto(`${BASE_URL}/account/password`);
  check(
    "deep link while signed out carries return-to",
    (await currentPathAndQuery(page)) === "/sign-in?next=%2Faccount%2Fpassword",
  );
  await signInViaUi(page, INITIAL_PASSWORD);
  await waitForPath(page, "/account/password");
  check("sign-in returns to the deep-linked page", true);
}

async function changePasswordJourney(page) {
  const authRequests = [];
  const recordRequest = (request) => {
    if (request.url().includes("/api/auth/")) {
      authRequests.push(request.url());
    }
  };
  page.on("request", recordRequest);
  await fillField(page, "Current password", INITIAL_PASSWORD);
  await fillField(page, "New password", CHANGED_PASSWORD);
  await fillField(page, "Confirm new password", `${CHANGED_PASSWORD}-typo`);
  await submit(page, "Change password");
  await waitForText(page, "do not match");
  page.off("request", recordRequest);
  check(
    "mismatched confirmation is rejected client-side with no request",
    authRequests.length === 0,
    authRequests.join(", "),
  );

  await fillField(page, "Current password", WRONG_PASSWORD);
  await fillField(page, "Confirm new password", CHANGED_PASSWORD);
  await submit(page, "Change password");
  await page.waitForFunction(
    () =>
      document
        .querySelector('input[name="currentPassword"]')
        ?.closest('[data-slot="field"]')
        ?.querySelector('[data-slot="field-error"], [role="alert"]'),
    { timeout: UI_TIMEOUT_MS },
  );
  check("wrong current password shows a field error", true);

  await fillField(page, "Current password", INITIAL_PASSWORD);
  await submit(page, "Change password");
  await waitForText(page, "Your password has been changed.");
  check("correct change shows the success notice", true);
  await page.goto(`${BASE_URL}${SIGNED_IN_LANDING_PATH}`);
  check(
    "user is still signed in after the change",
    (await currentPathAndQuery(page)) === SIGNED_IN_LANDING_PATH && (await visibleText(page)).includes(ACCOUNT_NAME),
  );

  await signOutViaUi(page);
  await signInViaUi(page, CHANGED_PASSWORD);
  await waitForPath(page, SIGNED_IN_LANDING_PATH);
  check("signing in with the new password works", true);
}

async function expiryJourney(page) {
  await page.deleteCookie({ name: ACCESS_COOKIE, url: BASE_URL });
  await page.goto(`${BASE_URL}/account/password`);
  check(
    "missing access cookie redirects like no session",
    (await currentPathAndQuery(page)) === "/sign-in?next=%2Faccount%2Fpassword",
    await currentPathAndQuery(page),
  );
}

async function backAfterSignOutJourney(page) {
  await signInViaUi(page, CHANGED_PASSWORD);
  await waitForPath(page, "/account/password");
  await page.goto(`${BASE_URL}${SIGNED_IN_LANDING_PATH}`);
  await signOutViaUi(page);
  await page.goBack();
  await page.waitForFunction(() => location.pathname === "/sign-in", { timeout: UI_TIMEOUT_MS });
  check(
    "Back after sign-out does not regain access to a protected page",
    (await currentPathAndQuery(page)).startsWith("/sign-in"),
    await currentPathAndQuery(page),
  );
}

async function expiryMidActionJourney(page) {
  await signInViaUi(page, CHANGED_PASSWORD);
  await waitForPath(page, "/account/password");
  await page.deleteCookie({ name: "promptizer_access", url: BASE_URL });
  await fillField(page, "Current password", CHANGED_PASSWORD);
  await fillField(page, "New password", INITIAL_PASSWORD);
  await fillField(page, "Confirm new password", INITIAL_PASSWORD);
  await submit(page, "Change password");
  await waitForPath(page, "/sign-in?next=%2Faccount%2Fpassword");
  check("session expiring mid-action redirects to sign-in with return-to", true);
}

const MOBILE_DEVICE_PROFILE = {
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  viewport: { width: 390, height: 844 },
};

const DESKTOP_DEVICE_PROFILE = { userAgent: null, viewport: DESKTOP_VIEWPORT };

const HYDRATION_PROBLEM_PATTERN = /hydrat|did not match|server rendered|recoverable error|minified react error/i;

async function collectDeviceProfile(browser, { userAgent, viewport }) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const consoleProblems = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleProblems.push(message.text());
    }
  });
  page.on("pageerror", (error) => consoleProblems.push(error.message));
  try {
    await page.setViewport(viewport);
    if (userAgent) {
      await page.setUserAgent(userAgent);
    }
    await page.goto(`${BASE_URL}/sign-in`);
    await signInViaUi(page, CHANGED_PASSWORD);
    await waitForPath(page, SIGNED_IN_LANDING_PATH);
    await waitForText(page, "All prompts");
    await new Promise((resolve) => setTimeout(resolve, 500));
    const profile = await page.evaluate(() => {
      const scripts = performance
        .getEntriesByType("resource")
        .filter((entry) => entry.name.endsWith(".js"))
        .map((entry) => entry.name);
      const jsBytes = performance
        .getEntriesByType("resource")
        .filter((entry) => entry.name.endsWith(".js"))
        .reduce((total, entry) => total + entry.transferSize, 0);
      return {
        path: location.pathname,
        mobileNav: Boolean(document.querySelector('nav[aria-label="Primary"]')),
        sidebarTrigger: Boolean(document.querySelector('[aria-label="Toggle sidebar"]')),
        scripts,
        jsBytes,
      };
    });
    profile.consoleProblems = consoleProblems.slice();
    return profile;
  } finally {
    await context.close();
  }
}

async function deviceSplitJourney(browser) {
  const desktop = await collectDeviceProfile(browser, DESKTOP_DEVICE_PROFILE);
  const mobile = await collectDeviceProfile(browser, MOBILE_DEVICE_PROFILE);
  check("mobile renders the mobile shell without the desktop sidebar", mobile.mobileNav && !mobile.sidebarTrigger);
  check("desktop renders the desktop shell without the mobile nav", desktop.sidebarTrigger && !desktop.mobileNav);
  check("mobile keeps the public url after the proxy rewrite", mobile.path === "/prompts", mobile.path);
  check("desktop keeps the public url", desktop.path === "/prompts", desktop.path);
  check(
    "no hydration problems on mobile",
    !mobile.consoleProblems.some((message) => HYDRATION_PROBLEM_PATTERN.test(message)),
    mobile.consoleProblems.join(" | ").slice(0, 160),
  );
  check(
    "no hydration problems on desktop",
    !desktop.consoleProblems.some((message) => HYDRATION_PROBLEM_PATTERN.test(message)),
    desktop.consoleProblems.join(" | ").slice(0, 160),
  );
  const desktopOnlyScripts = desktop.scripts.filter((url) => !mobile.scripts.includes(url));
  const mobileOnlyScripts = mobile.scripts.filter((url) => !desktop.scripts.includes(url));
  check(
    "device bundle graphs diverge",
    desktopOnlyScripts.length > 0 && mobileOnlyScripts.length > 0,
    `desktop-only ${desktopOnlyScripts.length}, mobile-only ${mobileOnlyScripts.length}`,
  );
  check(
    "mobile transfers less js than desktop",
    mobile.jsBytes < desktop.jsBytes,
    `mobile ${mobile.jsBytes} vs desktop ${desktop.jsBytes}`,
  );
}

async function desktopShellJourney(browser) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  try {
    await page.setViewport(DESKTOP_VIEWPORT);
    await page.goto(`${BASE_URL}/sign-in`);
    await signInViaUi(page, CHANGED_PASSWORD);
    await waitForPath(page, SIGNED_IN_LANDING_PATH);
    await waitForText(page, "All prompts");

    await page.keyboard.press("/");
    const searchFocused = await page.evaluate(() => document.activeElement?.getAttribute("name") === "q");
    check("slash focuses the search field", searchFocused);
    await page.keyboard.type("a/b");
    const typedValue = await page.$eval('input[name="q"]', (input) => input.value);
    check("slash is typed normally while searching", typedValue === "a/b", typedValue);

    const sidebar = await page.evaluate(() => ({
      newPromptActions: [...document.querySelectorAll("a")].filter((link) => link.textContent.trim() === "New prompt")
        .length,
      navLabels: [...document.querySelectorAll('[data-sidebar="menu-button"]')].map((item) => item.textContent.trim()),
    }));
    check("desktop shows a single new-prompt action", sidebar.newPromptActions === 1, String(sidebar.newPromptActions));
    check("sidebar lists prompt navigation only", !sidebar.navLabels.some((label) => /pack/i.test(label)));

    await page.click('[data-sidebar="menu-button"][href="/prompts/new"]');
    await waitForPath(page, "/prompts/new");

    const packsResponse = await page.goto(`${BASE_URL}/packs`);
    check("packs route no longer exists", packsResponse?.status() === 404, String(packsResponse?.status()));

    await page.goto(`${BASE_URL}${SIGNED_IN_LANDING_PATH}`);
    await waitForText(page, "No prompts yet");
    await page.click('button[aria-label^="Current theme"]');
    const modeAfter = await page.evaluate(() => document.documentElement.dataset.themeMode);
    check("theme switcher cycles from system to light", modeAfter === "light", String(modeAfter));

    await page.click('button[data-sidebar="trigger"]');
    await page.waitForFunction(() => document.cookie.includes("sidebar_state=false"));
    await page.reload();
    const collapsed = await page.$eval('[data-slot="sidebar"]', (node) => node.getAttribute("data-state"));
    check("collapsed sidebar survives reload", collapsed === "collapsed", String(collapsed));

    await page.goto(`${BASE_URL}/examples`);
    await waitForText(page, "Pre-built pages and patterns");
    const exampleLinks = await page.$$eval('main a[href^="/examples/"]', (links) => links.length);
    check("examples gallery lists the sample pages", exampleLinks >= 30, String(exampleLinks));

    await page.goto(`${BASE_URL}/examples/default`);
    await page.waitForSelector("svg.recharts-surface", { timeout: UI_TIMEOUT_MS });
    check("sample dashboard renders its chart inside the shell", true);

    await page.goto(`${BASE_URL}/examples/auth/v1/login`);
    await waitForText(page, "Login");
    check("sample auth page renders", true);

    await page.goto(`${BASE_URL}${SIGNED_IN_LANDING_PATH}`);
    await page.click('button[aria-label^="Account menu"]');
    await waitForText(page, "Change password");
    await page.evaluate(() => {
      [...document.querySelectorAll('[role="menuitem"]')]
        .find((item) => item.textContent.trim() === "Sign out")
        .click();
    });
    await waitForPath(page, "/sign-in");
    check("desktop account menu signs out", true);
  } finally {
    await context.close();
  }
}

async function themeJourney(browser) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  try {
    await page.goto(`${BASE_URL}/sign-in`);
    const initial = await page.evaluate(() => ({ ...document.documentElement.dataset }));
    check("promptizer preset is applied", initial.themePreset === "promptizer", String(initial.themePreset));
    await page.setCookie({ name: "theme_mode", value: "dark", url: BASE_URL });
    await page.reload();
    const stored = await page.evaluate(() => ({
      mode: document.documentElement.dataset.themeMode,
      dark: document.documentElement.classList.contains("dark"),
    }));
    check("stored dark mode applies before first paint", stored.mode === "dark" && stored.dark, JSON.stringify(stored));
    const requestedHosts = await page.evaluate(() =>
      performance.getEntriesByType("resource").map((entry) => new URL(entry.name).host),
    );
    const thirdParty = requestedHosts.filter((host) => host !== new URL(BASE_URL).host);
    check("no third-party requests", thirdParty.length === 0, thirdParty.join(","));
  } finally {
    await context.close();
  }
}

const MINIMUM_TAP_TARGET_PX = 44;

async function mobileShellJourney(browser) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  try {
    await page.setViewport({ ...MOBILE_DEVICE_PROFILE.viewport, isMobile: true, hasTouch: true });
    await page.setUserAgent(MOBILE_DEVICE_PROFILE.userAgent);
    await page.goto(`${BASE_URL}/sign-in`);
    await signInViaUi(page, CHANGED_PASSWORD);
    await waitForPath(page, SIGNED_IN_LANDING_PATH);
    await waitForText(page, "All prompts");

    const layout = await page.evaluate(() => ({
      overflowsHorizontally: document.documentElement.scrollWidth > window.innerWidth,
      newPromptActions: [...document.querySelectorAll("a")].filter((link) => link.textContent.trim() === "New prompt")
        .length,
      tabHeights: [...document.querySelectorAll('nav[aria-label="Primary"] a')].map((tab) => tab.offsetHeight),
    }));
    check("mobile page does not scroll sideways", !layout.overflowsHorizontally);
    check("mobile has no duplicate new-prompt button in the page header", layout.newPromptActions === 0);
    check(
      "mobile tabs are tappable",
      layout.tabHeights.length === 2 && layout.tabHeights.every((height) => height >= MINIMUM_TAP_TARGET_PX),
      layout.tabHeights.join(","),
    );

    await page.click('button[aria-label="Search prompts"]');
    await page.type('input[type="search"]', "email");
    await page.keyboard.press("Enter");
    await waitForPath(page, "/prompts?q=email");
    check("mobile search submits to the prompt list", true);

    await page.click('nav[aria-label="Primary"] a[href="/prompts/new"]');
    await waitForPath(page, "/prompts/new");
    const newTabCurrent = await page.$eval('nav[aria-label="Primary"] a[href="/prompts/new"]', (tab) =>
      tab.getAttribute("aria-current"),
    );
    check("mobile marks the current tab", newTabCurrent === "page", String(newTabCurrent));

    await page.click('button[aria-label^="Account menu"]');
    await waitForText(page, "Change password");
    await page.evaluate(() => {
      [...document.querySelectorAll("button")].find((button) => button.textContent.trim() === "Sign out").click();
    });
    await waitForPath(page, "/sign-in");
    check("mobile account sheet signs out", true);
  } finally {
    await context.close();
  }
}

const server = startServer();
let browser;
try {
  await waitForServer();
  browser = await puppeteer.launch({ headless: true, args: SANDBOX_ARGS, defaultViewport: DESKTOP_VIEWPORT });
  const page = await browser.newPage();
  await journey("theme", () => themeJourney(browser));
  await journey("anonymous guard", () => anonymousJourney(page));
  await journey("registration", () => registrationJourney(page));
  await journey("duplicate registration", () => duplicateRegistrationJourney(browser));
  await journey("sign-in and return-to", () => guardedAuthPagesAndSignInJourney(page));
  await journey("change password", () => changePasswordJourney(page));
  await journey("expiry", () => expiryJourney(page));
  await journey("back after sign-out", () => backAfterSignOutJourney(page));
  await journey("expiry mid-action", () => expiryMidActionJourney(page));
  await journey("device split", () => deviceSplitJourney(browser));
  await journey("desktop shell", () => desktopShellJourney(browser));
  await journey("mobile shell", () => mobileShellJourney(browser));
} finally {
  await browser?.close();
  stopServer(server);
  const removed = await removeE2eUsers().catch((error) => {
    check("cleanup removed e2e users", false, String(error));
    return 0;
  });
  console.log(`cleanup removed ${removed} user(s)`);
}

console.log(failures.length === 0 ? "ALL PASSED" : `${failures.length} FAILED`);
process.exit(failures.length === 0 ? 0 : 1);
