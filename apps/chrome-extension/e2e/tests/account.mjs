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
const SECOND_USER = { id: "user-2", email: "grace@example.com", name: "Grace" };
const USERS_BY_EMAIL = { [SIGNED_IN_USER.email]: SIGNED_IN_USER, [SECOND_USER.email]: SECOND_USER };
const WORK_PACK = { id: "pack-1", name: "Work" };

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

function initialLibraries() {
  return {
    [SIGNED_IN_USER.id]: {
      prompts: [promptFixture("prompt-1", "Weekly report", WORK_PACK), promptFixture("prompt-2", "Bug triage", null)],
      packs: [{ ...WORK_PACK, promptCount: 1 }],
    },
    [SECOND_USER.id]: { prompts: [promptFixture("prompt-9", "Grace only", null)], packs: [] },
  };
}

function accessTokenFor(user) {
  return `access-${user.id}`;
}

function userForRequest(request) {
  const authorization = request.headers()["authorization"] ?? "";
  return Object.values(USERS_BY_EMAIL).find((user) => authorization === `Bearer ${accessTokenFor(user)}`);
}

function sessionBody(user) {
  return {
    accessToken: accessTokenFor(user),
    refreshToken: `refresh-${user.id}`,
    expiresAt: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_LIFETIME_SECONDS,
    user,
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
      const user = userForRequest(request);
      if (state.libraryUnreachable || !user) {
        request.respond({ status: 503, headers: json, body: JSON.stringify({ code: "unavailable", message: "Down" }) });
        return;
      }
      const library = { ...state.libraries[user.id], fetchedAt: Math.floor(Date.now() / 1000) };
      request.respond({ status: 200, headers: json, body: JSON.stringify(library) });
      return;
    }
    if (url.pathname.endsWith("/me")) {
      request.respond({ status: 200, headers: json, body: JSON.stringify(userForRequest(request)) });
      return;
    }
    if (url.pathname.endsWith("/sign-in")) {
      const { email } = JSON.parse(request.postData() ?? "{}");
      request.respond({ status: 200, headers: json, body: JSON.stringify(sessionBody(USERS_BY_EMAIL[email])) });
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

async function everyStoredValue(page) {
  return page.evaluate(async () => {
    const areas = await Promise.all([
      chrome.storage.local.get(null),
      chrome.storage.session.get(null),
      chrome.storage.sync.get(null),
    ]);
    return JSON.stringify(areas);
  });
}

async function signIn(popup, email) {
  await (await popup.waitForSelector("aria/Email")).type(email);
  await (await popup.waitForSelector("aria/Password")).type("password");
  await (await popup.waitForSelector('aria/Sign in[role="button"]')).click();
  await waitForText(popup, email);
}

async function signOut(popup) {
  await (await popup.waitForSelector('aria/Sign out[role="button"]')).click();
  await waitForText(popup, "Use your Promptizer account");
}

async function waitForText(page, pattern, timeoutMs = 5000) {
  await page.waitForFunction(
    (source) => new RegExp(source, "i").test(document.body.innerText),
    { timeout: timeoutMs },
    pattern,
  );
}

await runCase("account", async (_page, check, browser) => {
  const state = { acceptCredentials: false, libraryUnreachable: false, libraries: initialLibraries(), requests: [] };
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

  state.libraries[SIGNED_IN_USER.id].prompts.push(promptFixture("prompt-3", "Release notes", WORK_PACK));
  await (await popup.waitForSelector('aria/Refresh[role="button"]')).click();
  await waitForText(popup, "3 prompts, 1 packs");
  check("refresh replaces the cache with the updated library", (await storedLibrary(popup))?.prompts.length === 3);

  state.libraryUnreachable = true;
  await (await popup.waitForSelector('aria/Refresh[role="button"]')).click();
  await waitForText(popup, "Couldn't reach Promptizer");
  check(
    "failed refresh keeps the previous cache with an honest error",
    (await storedLibrary(popup))?.prompts.length === 3 &&
      /3 prompts, 1 packs/.test(await popup.$eval("body", (body) => body.innerText)),
  );
  state.libraryUnreachable = false;

  await popup.evaluate((key) => chrome.storage.local.set({ [key]: { prompts: "corrupt" } }), LIBRARY_STORAGE_KEY);
  await popup.close();
  popup = await openAccountScreen(browser, state);
  await waitForText(popup, "3 prompts, 1 packs");
  check("corrupt cache recovers through an automatic refresh", (await storedLibrary(popup))?.prompts.length === 3);

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
  const storedAfterSignOut = await everyStoredValue(popup);
  check(
    "no prompt content or token remains in any extension storage after sign-out",
    !["Weekly report", "Release notes", "access-user-1", "refresh-user-1"].some((secret) =>
      storedAfterSignOut.includes(secret),
    ),
  );

  await signIn(popup, SECOND_USER.email);
  await waitForText(popup, "1 prompts, 0 packs");
  const secondAccountIds = (await storedLibrary(popup))?.prompts.map((prompt) => prompt.id);
  check(
    "a second account's cache holds only its own library",
    JSON.stringify(secondAccountIds) === JSON.stringify(["prompt-9"]),
    String(secondAccountIds),
  );

  await signOut(popup);
  await signIn(popup, SIGNED_IN_USER.email);
  await waitForText(popup, "3 prompts, 1 packs");
  const rebuiltIds = (await storedLibrary(popup))?.prompts.map((prompt) => prompt.id);
  check(
    "signing back in rebuilds the cache from the account",
    JSON.stringify(rebuiltIds) === JSON.stringify(["prompt-1", "prompt-2", "prompt-3"]),
    String(rebuiltIds),
  );
});
