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

const SEED_PROMPTS = [
  ["Mentoring Junior Engineers on Pipeline Architecture", "chatgpt", "System architecture", ["engineering", "it"]],
  [
    "Code Review Checklist for Quality and Maintainability",
    "chatgpt",
    "Technical reviews",
    ["code-review", "engineering"],
  ],
  ["Step-by-Step Software Implementation", "claude", "Implementation", ["best-practices", "engineering"]],
  ["Create Product Feature Documentation", "claude", "Documentation", ["documentation", "product"]],
  ["Summarize a Dataset and Surface Anomalies", "gemini", "Data analysis", ["analytics"]],
  ["Debug a Failing Test with Ranked Hypotheses", "chatgpt", "Debugging", ["debugging", "engineering"]],
  ["Write a Clear Incident Update", "claude", "Incident communication", ["communication", "it"]],
];

async function seedPrompts() {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    throw error;
  }
  const userId = data.users.find((user) => user.email === email)?.id;
  if (!userId) {
    throw new Error("E2E user not found for seeding");
  }
  const unwrap = ({ data: rows, error: failure }) => {
    if (failure) {
      throw failure;
    }
    return rows;
  };
  const names = (pick) => [...new Set(SEED_PROMPTS.flatMap(pick))].map((name) => ({ user_id: userId, name }));
  const categories = unwrap(
    await admin
      .from("category")
      .insert(names((seed) => [seed[2]]))
      .select(),
  );
  const tags = unwrap(
    await admin
      .from("tag")
      .insert(names((seed) => seed[3]))
      .select(),
  );
  const idOf = (rows, name) => rows.find((row) => row.name === name).id;
  for (const [title, model, category, tagNames] of SEED_PROMPTS) {
    const [prompt] = unwrap(
      await admin
        .from("prompt")
        .insert({ user_id: userId, title, model, category_id: idOf(categories, category) })
        .select(),
    );
    unwrap(
      await admin
        .from("prompt_version")
        .insert({ prompt_id: prompt.id, version_number: 1, body: `Body of ${title}` })
        .select(),
    );
    unwrap(
      await admin
        .from("prompt_tag")
        .insert(tagNames.map((name) => ({ prompt_id: prompt.id, tag_id: idOf(tags, name), user_id: userId })))
        .select(),
    );
  }
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
    check(
      "sidebar lists a packs section",
      sidebar.navLabels.some((label) => /pack/i.test(label)),
    );

    await page.click('[data-sidebar="menu-button"][href="/prompts/new"]');
    await waitForPath(page, "/prompts/new");

    const packsResponse = await page.goto(`${BASE_URL}/packs`);
    check("packs route exists", packsResponse?.status() === 200, String(packsResponse?.status()));

    await page.goto(`${BASE_URL}${SIGNED_IN_LANDING_PATH}`);
    await page.waitForSelector("a[href^='/prompts/']");
    const cardCount = await page.$$eval("a[href^='/prompts/'][data-testid='prompt-card']", (cards) => cards.length);
    check("all prompts shows the prompt cards", cardCount >= 6, String(cardCount));

    await page.goto(`${BASE_URL}/prompts?q=incident`);
    await waitForText(page, "Write a Clear Incident Update");
    const searchedCount = await page.$$eval("a[href^='/prompts/'][data-testid='prompt-card']", (cards) => cards.length);
    check("search narrows the prompt list", searchedCount === 1, String(searchedCount));

    await page.goto(`${BASE_URL}/prompts?q=zzzz-no-match`);
    await waitForText(page, "No results");

    await page.goto(`${BASE_URL}/prompts?tag=debugging`);
    await waitForText(page, "Debug a Failing Test");
    const taggedCount = await page.$$eval("a[href^='/prompts/'][data-testid='prompt-card']", (cards) => cards.length);
    check("tag filter narrows the prompt list", taggedCount === 1, String(taggedCount));

    await page.click("button ::-p-text(Tag: debugging)");
    await waitForText(page, "Clear tag filter");
    await page.keyboard.press("Escape");

    await page.goto(`${BASE_URL}/prompts?view=table`);
    await page.waitForSelector("table");
    const rowCount = await page.$$eval("tbody tr", (rows) => rows.length);
    check("table view lists every prompt", rowCount >= 6, String(rowCount));
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
      layout.tabHeights.length === 3 && layout.tabHeights.every((height) => height >= MINIMUM_TAP_TARGET_PX),
      layout.tabHeights.join(","),
    );

    check("mobile list shows one search field", (await page.$$('input[type="search"]')).length === 1);
    await page.type('[data-testid="list-search"]', "email");
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

const PROMPT_ID_IN_PATH = /^\/prompts\/[0-9a-f-]{36}$/;
const LIST_PROMPT_COUNT = 14;
const LIST_PAGE_SIZE = 12;

function newE2eEmail() {
  return `${E2E_EMAIL_PREFIX}${crypto.randomUUID()}@example.com`;
}

async function authViaApi(path, payload) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}`);
  }
  return response.json();
}

function registerViaApi(emailAddress) {
  return authViaApi("/api/auth/register", { name: ACCOUNT_NAME, email: emailAddress, password: INITIAL_PASSWORD });
}

function signInViaApi(emailAddress, password) {
  return authViaApi("/api/auth/sign-in", { email: emailAddress, password });
}

function promptApi(session, path, init = {}) {
  return fetch(`${BASE_URL}/api/prompts${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.accessToken}` },
  });
}

async function createPromptViaApi(session, draft) {
  const response = await promptApi(session, "", { method: "POST", body: JSON.stringify(draft) });
  if (response.status !== 201) {
    throw new Error(`create prompt failed with ${response.status}`);
  }
  return response.json();
}

async function readPromptViaApi(session, id) {
  const response = await promptApi(session, `/${id}`);
  return response.ok ? response.json() : undefined;
}

async function openSignedInPage(browser, session, profile = DESKTOP_DEVICE_PROFILE) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const consoleProblems = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleProblems.push(message.text());
    }
  });
  page.on("pageerror", (error) => consoleProblems.push(error.message));
  if (profile.userAgent) {
    await page.setViewport({ ...profile.viewport, isMobile: true, hasTouch: true });
    await page.setUserAgent(profile.userAgent);
  } else {
    await page.setViewport(profile.viewport);
  }
  await page.setCookie({ name: ACCESS_COOKIE, value: session.accessToken, url: BASE_URL });
  return { context, page, consoleProblems };
}

async function cardTitles(page) {
  return page.$$eval("a[href^='/prompts/'][data-testid='prompt-card'] h3", (titles) =>
    titles.map((title) => title.textContent),
  );
}

async function headingCount(page) {
  return page.$eval('[aria-label$=" items"]', (badge) => Number(badge.textContent));
}

async function waitForSaveStatus(page, prefix) {
  await page.waitForFunction(
    (expected) => document.querySelector('[data-testid="save-status"]')?.textContent?.startsWith(expected),
    { timeout: UI_TIMEOUT_MS },
    prefix,
  );
}

async function moveCaretToEnd(page, selector) {
  await page.focus(selector);
  await page.$eval(selector, (field) => field.setSelectionRange(field.value.length, field.value.length));
}

async function ownerUserId(emailAddress) {
  const { data, error } = await createAdminClient().auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    throw error;
  }
  return data.users.find((user) => user.email === emailAddress)?.id;
}

async function seededPromptId(title) {
  const { data, error } = await createAdminClient()
    .from("prompt")
    .select("id")
    .eq("user_id", await ownerUserId(email))
    .eq("title", title)
    .single();
  if (error) {
    throw error;
  }
  return data.id;
}

async function ownershipJourney(browser) {
  const foreignId = await seededPromptId(SEED_PROMPTS[0][0]);
  const outsiderEmail = newE2eEmail();
  const outsider = await registerViaApi(outsiderEmail);
  const { context, page } = await openSignedInPage(browser, outsider);
  try {
    const response = await page.goto(`${BASE_URL}/prompts/${foreignId}`);
    check("foreign prompt page is not found", response?.status() === 404, String(response?.status()));
    await waitForText(page, "Page not found");
    const editResponse = await page.goto(`${BASE_URL}/prompts/${foreignId}/edit`);
    check("foreign prompt editor is not found", editResponse?.status() === 404, String(editResponse?.status()));

    const patched = await promptApi(outsider, `/${foreignId}`, {
      method: "PATCH",
      body: JSON.stringify({ title: "Hijacked" }),
    });
    const deleted = await promptApi(outsider, `/${foreignId}`, { method: "DELETE" });
    check("foreign prompt update is not found", patched.status === 404, String(patched.status));
    check("foreign prompt delete is not found", deleted.status === 404, String(deleted.status));
    const { data: survivor } = await createAdminClient().from("prompt").select("title").eq("id", foreignId).single();
    check("foreign prompt is untouched", survivor?.title === SEED_PROMPTS[0][0], String(survivor?.title));

    await page.goto(`${BASE_URL}/prompts`);
    await waitForText(page, "No prompts yet");
    const listed = await visibleText(page);
    check("other accounts' prompts are not listed", !SEED_PROMPTS.some(([title]) => listed.includes(title)));
    const firstPromptHref = await page.$eval("main a ::-p-text(Create your first prompt)", (node) =>
      node.closest("a").getAttribute("href"),
    );
    check("empty state offers to create the first prompt", firstPromptHref === "/prompts/new", String(firstPromptHref));

    const own = await createPromptViaApi(outsider, { title: "Outsider deep link", text: "Owned by the outsider" });
    const anonymousContext = await browser.createBrowserContext();
    const anonymousPage = await anonymousContext.newPage();
    try {
      await anonymousPage.goto(`${BASE_URL}/prompts/${own.id}`);
      await waitForPath(anonymousPage, `/sign-in?next=%2Fprompts%2F${own.id}`);
      await fillField(anonymousPage, "Email", outsiderEmail);
      await fillField(anonymousPage, "Password", INITIAL_PASSWORD);
      await submit(anonymousPage, "Sign in");
      await waitForPath(anonymousPage, `/prompts/${own.id}`);
      await waitForText(anonymousPage, "Owned by the outsider");
      check("prompt deep link survives sign-in", true);
    } finally {
      await anonymousContext.close();
    }
  } finally {
    await context.close();
  }
}

async function createAndViewJourney(browser, session) {
  const { context, page, consoleProblems } = await openSignedInPage(browser, session);
  try {
    await page.goto(`${BASE_URL}/prompts/new`);
    await submit(page, "Save prompt");
    await waitForText(page, "Enter a title.");
    check("missing title is reported inline", (await currentPathAndQuery(page)) === "/prompts/new");

    await fillField(page, "Title", "E2E markdown prompt");
    await fillField(
      page,
      "Prompt text",
      "# Heading\n**bold** <script>window.__xss=1</script> [bad](javascript:alert(1))",
    );
    await page.waitForSelector('[data-testid="markdown-preview"] h2', { timeout: UI_TIMEOUT_MS });
    const preview = await page.evaluate(() => {
      const root = document.querySelector('[data-testid="markdown-preview"]');
      return {
        heading: root.querySelector("h2")?.textContent,
        bold: root.querySelector("strong")?.textContent,
        scriptText: root.textContent.includes("<script>"),
        scriptElements: root.querySelectorAll("script").length,
        javascriptLinks: document.querySelectorAll('a[href^="javascript"]').length,
        injected: window.__xss,
      };
    });
    check(
      "preview renders markdown and keeps raw html as text",
      preview.heading === "Heading" &&
        preview.bold === "bold" &&
        preview.scriptText &&
        preview.scriptElements === 0 &&
        preview.javascriptLinks === 0 &&
        preview.injected === undefined,
      JSON.stringify(preview),
    );

    await submit(page, "Save prompt");
    await page.waitForFunction(
      (pattern) => new RegExp(pattern).test(location.pathname),
      { timeout: UI_TIMEOUT_MS },
      PROMPT_ID_IN_PATH.source,
    );
    const promptPath = new URL(page.url()).pathname;
    await page.waitForSelector('[data-testid="markdown-preview"] h2', { timeout: UI_TIMEOUT_MS });
    const view = await page.evaluate(
      (path) => ({
        title: document.querySelector("main h1")?.textContent,
        bold: document.querySelector('[data-testid="markdown-preview"] strong')?.textContent,
        edit: Boolean(document.querySelector(`a[href="${path}/edit"]`)),
        remove: Boolean(document.querySelector(`a[href="${path}/delete"]`)),
      }),
      promptPath,
    );
    check(
      "saving opens the new prompt with edit and delete entry points",
      view.title === "E2E markdown prompt" && view.bold === "bold" && view.edit && view.remove,
      JSON.stringify(view),
    );
    await page.reload();
    await waitForText(page, "E2E markdown prompt");
    check("prompt page is deep-linkable", (await currentPathAndQuery(page)) === promptPath);
    check(
      "no hydration problems on prompt pages",
      !consoleProblems.some((message) => HYDRATION_PROBLEM_PATTERN.test(message)),
      consoleProblems.join(" | ").slice(0, 160),
    );
  } finally {
    await context.close();
  }
}

async function listJourney(browser) {
  const listUserEmail = newE2eEmail();
  const session = await registerViaApi(listUserEmail);
  const [category] = (
    await createAdminClient().from("category").insert({ user_id: session.user.id, name: "Research" }).select()
  ).data;
  for (let index = 1; index <= LIST_PROMPT_COUNT; index += 1) {
    const number = String(index).padStart(2, "0");
    await createPromptViaApi(session, {
      title: `List prompt ${number}`,
      text: `Body for list prompt ${number}`,
      categoryId: index <= 2 ? category.id : null,
    });
  }
  const { context, page } = await openSignedInPage(browser, session);
  try {
    await page.goto(`${BASE_URL}/prompts`);
    await waitForText(page, "All prompts");
    check("heading shows the total count", (await headingCount(page)) === LIST_PROMPT_COUNT);
    const firstPage = await cardTitles(page);
    check(
      "first page is full and newest first",
      firstPage.length === LIST_PAGE_SIZE && firstPage[0] === "List prompt 14",
      `${firstPage.length} ${firstPage[0]}`,
    );
    await page.click("a[rel='next']");
    await waitForPath(page, "/prompts?page=2");
    await page.waitForFunction(() => document.querySelectorAll("a[data-testid='prompt-card']").length === 2, {
      timeout: UI_TIMEOUT_MS,
    });
    check("second page holds the remainder", true);

    await page.goto(`${BASE_URL}/prompts?q=list`);
    const nextHref = await page.$eval("a[rel='next']", (link) => link.getAttribute("href"));
    check("pagination keeps the search", nextHref === "/prompts?q=list&page=2", String(nextHref));

    await page.goto(`${BASE_URL}/prompts?category=${category.id}`);
    await waitForText(page, "Category: Research");
    check("category filter restricts the list", (await cardTitles(page)).length === 2);
    await page.click("button ::-p-text(Category: Research)");
    await waitForText(page, "Clear category filter");
    await page.keyboard.press("Escape");

    await page.type('[data-testid="list-search"]', "prompt 01");
    await page.keyboard.press("Enter");
    await waitForPath(page, `/prompts?q=prompt+01&category=${category.id}`);
    const searched = await cardTitles(page);
    check("search on enter keeps the category", searched.length === 1 && searched[0] === "List prompt 01");
    await waitForText(page, "Search: prompt 01");
    await page.click("a ::-p-text(Clear all)");
    await waitForPath(page, "/prompts");
    check("clear all removes every filter", true);

    await page.goto(`${BASE_URL}/prompts?page=99`);
    await waitForText(page, "This page is empty");
    check(
      "out-of-range page offers the first page",
      (await page.$eval("main a ::-p-text(Go to first page)", (node) => node.closest("a").getAttribute("href"))) ===
        "/prompts",
    );

    await page.goto(`${BASE_URL}/prompts?q=zzzz-nothing`);
    await waitForText(page, "No results");
    check(
      "no-result state offers clear filters",
      Boolean(await page.$("main a[href='/prompts'] ::-p-text(Clear filters)")),
    );
  } finally {
    await context.close();
  }

  const mobile = await openSignedInPage(browser, session, MOBILE_DEVICE_PROFILE);
  try {
    await mobile.page.goto(`${BASE_URL}/prompts?q=list`);
    await waitForText(mobile.page, "All prompts");
    const mobileState = await mobile.page.evaluate(() => ({
      mobileNav: Boolean(document.querySelector('nav[aria-label="Primary"]')),
      cards: document.querySelectorAll("a[data-testid='prompt-card']").length,
      next: document.querySelector("a[rel='next']")?.getAttribute("href"),
      path: location.pathname + location.search,
    }));
    check(
      "mobile list paginates with filters",
      mobileState.mobileNav &&
        mobileState.cards === LIST_PAGE_SIZE &&
        mobileState.next === "/prompts?q=list&page=2" &&
        mobileState.path === "/prompts?q=list",
      JSON.stringify(mobileState),
    );
  } finally {
    await mobile.context.close();
  }
}

async function autoSaveJourney(browser, session) {
  const first = await createPromptViaApi(session, { title: "Autosave first", text: "Original first" });
  const second = await createPromptViaApi(session, { title: "Autosave second", text: "Original second" });
  const { context, page } = await openSignedInPage(browser, session);
  const patches = [];
  const dialogs = [];
  let abortSaves = false;
  let acceptDialogs = false;
  page.on("request", (request) => {
    if (request.method() === "PATCH") {
      patches.push({ url: request.url(), body: request.postData() ?? "" });
    }
    if (request.isInterceptResolutionHandled()) {
      return;
    }
    if (abortSaves && request.method() === "PATCH") {
      request.abort();
    } else {
      request.continue();
    }
  });
  page.on("dialog", (dialog) => {
    dialogs.push(dialog.type());
    return acceptDialogs ? dialog.accept() : dialog.dismiss();
  });
  try {
    await page.setRequestInterception(true);
    await page.goto(`${BASE_URL}/prompts/${first.id}/edit`);
    await waitForSaveStatus(page, "No changes yet");
    await moveCaretToEnd(page, "#prompt-text");
    await page.keyboard.type(" more", { delay: 30 });
    await waitForSaveStatus(page, "Saved");
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const firstPatches = patches.filter((patch) => patch.url.endsWith(`/api/prompts/${first.id}`));
    check(
      "typing then pausing saves once",
      firstPatches.length === 1 && firstPatches[0].body.includes("Original first more"),
      String(firstPatches.length),
    );
    const characterCount = await page.$eval('[data-testid="character-count"]', (node) => node.textContent);
    check("character count follows the text", characterCount.startsWith("19 /"), characterCount);
    await page.reload();
    const persisted = await page.$eval("#prompt-text", (field) => field.value);
    check("auto-saved text persists", persisted === "Original first more", persisted);

    abortSaves = true;
    await moveCaretToEnd(page, "#prompt-text");
    await page.keyboard.type(" fail");
    await waitForSaveStatus(page, "Couldn't save");
    abortSaves = false;
    await submit(page, "Retry");
    await waitForSaveStatus(page, "Saved");
    const retried = await readPromptViaApi(session, first.id);
    check("retry saves after a failure", retried?.text === "Original first more fail", retried?.text);

    abortSaves = true;
    await moveCaretToEnd(page, "#prompt-text");
    await page.keyboard.type(" x");
    await waitForSaveStatus(page, "Couldn't save");
    await page.click('[data-sidebar="menu-button"][href="/prompts"]');
    await new Promise((resolve) => setTimeout(resolve, 500));
    check(
      "leaving with unsaved text warns and can stay",
      dialogs.length === 1 && new URL(page.url()).pathname === `/prompts/${first.id}/edit`,
      `${dialogs.join(",")} ${new URL(page.url()).pathname}`,
    );
    acceptDialogs = true;
    await page.click('[data-sidebar="menu-button"][href="/prompts"]');
    await waitForPath(page, "/prompts");
    check("confirming leaves after one warning", dialogs.length === 2, dialogs.join(","));
    abortSaves = false;

    await page.goto(`${BASE_URL}/prompts/${first.id}/edit`);
    await waitForSaveStatus(page, "No changes yet");
    await moveCaretToEnd(page, "#prompt-text");
    await page.keyboard.type("XYZ");
    await page.goto(`${BASE_URL}/prompts/${second.id}/edit`);
    await waitForSaveStatus(page, "No changes yet");
    await moveCaretToEnd(page, "#prompt-text");
    await page.keyboard.type(" second");
    await waitForSaveStatus(page, "Saved");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const strayPatches = patches.filter(
      (patch) => patch.body.includes("XYZ") && !patch.url.endsWith(`/api/prompts/${first.id}`),
    );
    const secondPrompt = await readPromptViaApi(session, second.id);
    check(
      "rapid navigation never saves into the wrong prompt",
      strayPatches.length === 0 && secondPrompt?.text === "Original second second",
      `${strayPatches.length} ${secondPrompt?.text}`,
    );
  } finally {
    await context.close();
  }
}

async function deleteJourney(browser, session) {
  const { data: category } = await createAdminClient()
    .from("category")
    .select("id")
    .eq("user_id", session.user.id)
    .eq("name", "Documentation")
    .single();
  const doomed = await createPromptViaApi(session, {
    title: "Delete me prompt",
    text: "Soon gone",
    categoryId: category.id,
  });
  const { context, page } = await openSignedInPage(browser, session);
  try {
    await page.goto(`${BASE_URL}/prompts`);
    await waitForText(page, "All prompts");
    const countBefore = await headingCount(page);

    await page.goto(`${BASE_URL}/prompts/${doomed.id}`);
    await page.click(`a[href="/prompts/${doomed.id}/delete"]`);
    await waitForPath(page, `/prompts/${doomed.id}/delete`);
    const confirmation = await visibleText(page);
    check(
      "delete confirmation names the prompt and warns",
      confirmation.includes("Delete me prompt") && confirmation.includes("can't be undone"),
    );
    await page.click("main a ::-p-text(Cancel)");
    await waitForPath(page, `/prompts/${doomed.id}`);
    check("cancel returns to the prompt", true);

    await page.goto(`${BASE_URL}/prompts/${doomed.id}/delete`);
    await submit(page, "Delete prompt");
    await waitForPath(page, "/prompts");
    await waitForText(page, "All prompts");
    const listed = await visibleText(page);
    const countAfter = await headingCount(page);
    check(
      "deleted prompt leaves the list",
      !listed.includes("Delete me prompt") && countAfter === countBefore - 1,
      `${countBefore} -> ${countAfter}`,
    );
    const gone = await page.goto(`${BASE_URL}/prompts/${doomed.id}`);
    check("deleted prompt url is not found", gone?.status() === 404, String(gone?.status()));
    const { data: keptCategory } = await createAdminClient().from("category").select("id").eq("id", category.id);
    check("deleting a prompt keeps its category", keptCategory?.length === 1);
  } finally {
    await context.close();
  }
}

async function packJourney(browser, session) {
  const { context, page } = await openSignedInPage(browser, session);
  try {
    await page.goto(`${BASE_URL}/packs/new`);
    await fillField(page, "Name", "Research notes");
    await submit(page, "Create pack");
    await waitForPath(page, "/packs");
    const afterCreate = await visibleText(page);
    check("created pack appears in the list", afterCreate.includes("Research notes"));

    const { data: created } = await createAdminClient()
      .from("category")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("name", "Research notes")
      .single();
    const packId = created.id;

    const inPack = await createPromptViaApi(session, {
      title: "Filed under research",
      text: "x",
      categoryId: packId,
    });
    await page.reload();
    const withCount = await visibleText(page);
    check("pack shows an updated prompt count", /Research notes[\s\S]*1/.test(withCount));

    await page.click(`a[href="/packs/${packId}/edit"]`);
    await waitForPath(page, `/packs/${packId}/edit`);
    await fillField(page, "Name", "Renamed research");
    await submit(page, "Save pack");
    await waitForPath(page, "/packs");
    const afterRename = await visibleText(page);
    check(
      "renamed pack shows its new name",
      afterRename.includes("Renamed research") && !afterRename.includes("Research notes"),
    );

    await page.click(`a[href="/packs/${packId}/delete"]`);
    await waitForPath(page, `/packs/${packId}/delete`);
    const confirmation = await visibleText(page);
    check(
      "delete confirmation names the pack and explains prompts are kept",
      confirmation.includes("Renamed research") && confirmation.includes("kept"),
    );
    await submit(page, "Delete pack");
    await waitForPath(page, "/packs");
    const afterDelete = await visibleText(page);
    check("deleted pack leaves the list", !afterDelete.includes("Renamed research"));

    const keptPrompt = await readPromptViaApi(session, inPack.id);
    check(
      "the pack's prompt survives, uncategorized",
      keptPrompt?.title === "Filed under research" && keptPrompt?.category === null,
    );
    await page.goto(`${BASE_URL}/prompts`);
    await waitForText(page, "All prompts");
    check(
      "the pack's prompt still appears under All prompts",
      (await visibleText(page)).includes("Filed under research"),
    );
  } finally {
    await context.close();
  }
}

async function mobilePromptPagesJourney(browser, session) {
  const target = await createPromptViaApi(session, { title: "Mobile prompt page", text: "## Mobile\n- item" });
  const { context, page, consoleProblems } = await openSignedInPage(browser, session, MOBILE_DEVICE_PROFILE);
  try {
    for (const path of [`/prompts/${target.id}`, `/prompts/${target.id}/edit`, `/prompts/${target.id}/delete`]) {
      await page.goto(`${BASE_URL}${path}`);
      await waitForText(page, "Mobile prompt page");
      const state = await page.evaluate(() => ({
        mobileNav: Boolean(document.querySelector('nav[aria-label="Primary"]')),
        sidebar: Boolean(document.querySelector('[aria-label="Toggle sidebar"]')),
        path: location.pathname,
        overflows: document.documentElement.scrollWidth > window.innerWidth,
      }));
      check(
        `mobile shell serves ${path.replace(target.id, "[id]")}`,
        state.mobileNav && !state.sidebar && state.path === path && !state.overflows,
        JSON.stringify(state),
      );
    }
    const buttonHeights = await page.$$eval("main a, main button", (nodes) => nodes.map((node) => node.offsetHeight));
    check(
      "mobile delete actions are tappable",
      buttonHeights.length >= 2 && buttonHeights.every((height) => height >= MINIMUM_TAP_TARGET_PX),
      buttonHeights.join(","),
    );
    check(
      "no hydration problems on mobile prompt pages",
      !consoleProblems.some((message) => HYDRATION_PROBLEM_PATTERN.test(message)),
      consoleProblems.join(" | ").slice(0, 160),
    );
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
  await seedPrompts();
  await journey("desktop shell", () => desktopShellJourney(browser));
  await journey("mobile shell", () => mobileShellJourney(browser));
  await journey("prompt ownership", () => ownershipJourney(browser));
  await journey("prompt list", () => listJourney(browser));
  const ownerSession = await signInViaApi(email, CHANGED_PASSWORD);
  await journey("create and view prompt", () => createAndViewJourney(browser, ownerSession));
  await journey("auto-save", () => autoSaveJourney(browser, ownerSession));
  await journey("delete prompt", () => deleteJourney(browser, ownerSession));
  await journey("pack create, rename and delete", () => packJourney(browser, ownerSession));
  await journey("mobile prompt pages", () => mobilePromptPagesJourney(browser, ownerSession));
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
