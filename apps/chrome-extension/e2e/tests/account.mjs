import { runCase, extensionId } from "../harness.mjs";

const API_PATH_PREFIXES = ["/api/auth/", "/api/library/"];
const LIBRARY_STORAGE_KEY = "promptizer.librarySnapshot";
const ACCESS_TOKEN_LIFETIME_SECONDS = 3600;
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const SIGNED_IN_USER = { id: "user-1", email: "ada@example.com", name: "Ada" };

function promptFixture(id, title, category) {
  const timestamp = new Date().toISOString();
  return {
    id,
    title,
    text: `${title} text`,
    model: null,
    category,
    tags: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function libraryBody() {
  const workPack = { id: "pack-1", name: "Work" };
  return {
    prompts: [promptFixture("prompt-1", "Weekly report", workPack), promptFixture("prompt-2", "Bug triage", null)],
    packs: [{ ...workPack, promptCount: 1 }],
    fetchedAt: Math.floor(Date.now() / 1000),
  };
}

function sessionBody() {
  return {
    accessToken: "access-token",
    refreshToken: "refresh-token",
    expiresAt: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_LIFETIME_SECONDS,
    user: SIGNED_IN_USER,
  };
}

async function mockAuthApi(page, state) {
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!API_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
      request.continue();
      return;
    }
    if (request.method() === "OPTIONS") {
      request.respond({ status: 204, headers: CORS_HEADERS });
      return;
    }
    state.requests.push(url.pathname);
    const json = { "Content-Type": "application/json", ...CORS_HEADERS };
    if (url.pathname.endsWith("/sign-in") && !state.acceptCredentials) {
      request.respond({
        status: 401,
        headers: json,
        body: JSON.stringify({ code: "invalid_credentials", message: "Email or password is incorrect." }),
      });
      return;
    }
    if (url.pathname.endsWith("/library/snapshot")) {
      request.respond({ status: 200, headers: json, body: JSON.stringify(libraryBody()) });
      return;
    }
    if (url.pathname.endsWith("/me")) {
      request.respond({ status: 200, headers: json, body: JSON.stringify(SIGNED_IN_USER) });
      return;
    }
    if (url.pathname.endsWith("/sign-in")) {
      request.respond({ status: 200, headers: json, body: JSON.stringify(sessionBody()) });
      return;
    }
    request.respond({ status: 204, headers: CORS_HEADERS });
  });
}

async function openAccountScreen(browser, state) {
  const popup = await browser.newPage();
  await mockAuthApi(popup, state);
  await popup.goto(`chrome-extension://${extensionId()}/popup.html`, { waitUntil: "networkidle0" });
  const accountNav = await popup.waitForSelector("aria/Account", { timeout: 5000 });
  await accountNav.click();
  return popup;
}

async function storedLibrary(page) {
  const stored = await page.evaluate((key) => chrome.storage.local.get(key), LIBRARY_STORAGE_KEY);
  return stored[LIBRARY_STORAGE_KEY];
}

async function waitForText(page, pattern, timeoutMs = 5000) {
  await page.waitForFunction(
    (source) => new RegExp(source, "i").test(document.body.innerText),
    { timeout: timeoutMs },
    pattern,
  );
}

await runCase("account", async (_page, check, browser) => {
  const state = { acceptCredentials: false, requests: [] };
  let popup = await openAccountScreen(browser, state);

  await waitForText(popup, "Use your Promptizer account");
  check("signed-out user sees the sign-in form", true);

  await (await popup.waitForSelector("aria/Email")).type(SIGNED_IN_USER.email);
  await (await popup.waitForSelector("aria/Password")).type("wrong-password");
  await (await popup.waitForSelector('aria/Sign in[role="button"]')).click();
  await waitForText(popup, "Email or password is incorrect");
  check("wrong credentials show one inline error", true);

  state.acceptCredentials = true;
  await (await popup.waitForSelector('aria/Sign in[role="button"]')).click();
  await waitForText(popup, SIGNED_IN_USER.email);
  check("successful sign-in shows the signed-in identity", true);

  await waitForText(popup, "2 prompts, 1 packs");
  check("sign-in caches the account's library locally", (await storedLibrary(popup))?.prompts.length === 2);

  await popup.close();
  popup = await openAccountScreen(browser, state);
  await waitForText(popup, SIGNED_IN_USER.email);
  check("reopening the popup keeps the user signed in", true);

  await (await popup.waitForSelector('aria/Sign out[role="button"]')).click();
  await waitForText(popup, "Use your Promptizer account");
  check("sign-out returns to the signed-out form", true);
  check(
    "sign-out reached the server",
    state.requests.some((path) => path.endsWith("/sign-out")),
  );

  await popup.close();
  popup = await openAccountScreen(browser, state);
  await waitForText(popup, "Use your Promptizer account");
  check("sign-out wiped the stored credentials", true);
  check("sign-out wiped the local library copy", (await storedLibrary(popup)) === undefined);
});
