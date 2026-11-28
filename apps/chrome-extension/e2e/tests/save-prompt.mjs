import { runCase, extensionId, focusAndType, ORIGINAL_PROMPT } from "../harness.mjs";

const SESSION_STORAGE_KEY = "promptizer.accountSession";
const SIGNED_IN_STORAGE_KEY = "promptizer.signedIn";
const FIRST_SAVE_NOTICE_KEY = "promptizer.firstSaveNoticeShown";
const OFFLINE_SAVE_MESSAGE = "You're offline. Your library is read-only until you reconnect.";
const UNREACHABLE_WRITE_MESSAGE = "Couldn't reach Promptizer, so nothing changed. Check your connection and retry.";
const SIGNED_OUT_WRITE_MESSAGE = "Your Promptizer session ended. Sign in again from the Promptizer popup.";
const LIBRARY_STORAGE_KEY = "promptizer.librarySnapshot";
const STORED_SESSION = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
  user: { id: "user-1", email: "ada@example.com", name: "Ada" },
};

async function setStoredSession(browser, session) {
  const extensionPage = await browser.newPage();
  await extensionPage.goto(`chrome-extension://${extensionId()}/popup.html`);
  await extensionPage.evaluate(
    (key, flagKey, value) =>
      value === null
        ? chrome.storage.local.remove([key, flagKey])
        : chrome.storage.local.set({ [key]: value, [flagKey]: true }),
    SESSION_STORAGE_KEY,
    SIGNED_IN_STORAGE_KEY,
    session,
  );
  await extensionPage.close();
}

async function setFirstSaveNoticeShown(browser, shown) {
  const extensionPage = await browser.newPage();
  await extensionPage.goto(`chrome-extension://${extensionId()}/popup.html`);
  await extensionPage.evaluate(
    (key, value) => (value ? chrome.storage.local.set({ [key]: true }) : chrome.storage.local.remove(key)),
    FIRST_SAVE_NOTICE_KEY,
    shown,
  );
  await extensionPage.close();
}

async function mockSavePromptApi(browser, respond) {
  const workerTarget = await browser.waitForTarget((target) => target.type() === "service_worker", {
    timeout: 5000,
  });
  const client = await workerTarget.createCDPSession();
  const requests = [];
  await client.send("Fetch.enable", { patterns: [{ urlPattern: "*/api/prompts*", requestStage: "Request" }] });
  client.on("Fetch.requestPaused", async (event) => {
    requests.push({ url: event.request.url, body: event.request.postData });
    const outcome = respond();
    await client.send("Fetch.fulfillRequest", {
      requestId: event.requestId,
      responseCode: outcome.status,
      responseHeaders: [{ name: "Content-Type", value: "application/json" }],
      body: Buffer.from(JSON.stringify(outcome.body)).toString("base64"),
    });
  });
  return { client, requests };
}

async function readStorage(browser, keys) {
  const extensionPage = await browser.newPage();
  await extensionPage.goto(`chrome-extension://${extensionId()}/popup.html`);
  const stored = await extensionPage.evaluate((wanted) => chrome.storage.local.get(wanted), keys);
  await extensionPage.close();
  return stored;
}

async function holdSavePromptApi(browser) {
  const workerTarget = await browser.waitForTarget((target) => target.type() === "service_worker", {
    timeout: 5000,
  });
  const client = await workerTarget.createCDPSession();
  let pausedRequestId;
  let resolvePaused;
  const paused = new Promise((resolve) => {
    resolvePaused = resolve;
  });
  await client.send("Fetch.enable", { patterns: [{ urlPattern: "*/api/prompts*", requestStage: "Request" }] });
  client.on("Fetch.requestPaused", (event) => {
    pausedRequestId = event.requestId;
    resolvePaused();
  });
  const release = (status, body) =>
    client.send("Fetch.fulfillRequest", {
      requestId: pausedRequestId,
      responseCode: status,
      responseHeaders: [{ name: "Content-Type", value: "application/json" }],
      body: Buffer.from(JSON.stringify(body)).toString("base64"),
    });
  return { client, paused, release };
}

await runCase("save-prompt", async (page, check, browser) => {
  await setStoredSession(browser, STORED_SESSION);
  await setFirstSaveNoticeShown(browser, true);
  await focusAndType(page);

  const rail = await page.waitForSelector("aria/Promptizer actions", { timeout: 5000 });
  await rail.click();
  await new Promise((r) => setTimeout(r, 200));

  const saveLeaf = await page.waitForSelector("aria/Save prompt", { timeout: 5000 });
  check("rail shows a Save prompt action when signed in", saveLeaf !== null);
  await saveLeaf.click();

  const titleInput = await page.waitForSelector('aria/Prompt title[role="textbox"]', { timeout: 5000 });
  const prefilled = await titleInput.evaluate((input) => input.value);
  check("title step is prefilled from the editor's captured text", prefilled === ORIGINAL_PROMPT, prefilled);

  let { client, requests } = await mockSavePromptApi(browser, () => ({
    status: 201,
    body: {
      id: "p1",
      title: "Cancelled",
      text: ORIGINAL_PROMPT,
      model: null,
      category: null,
      tags: [],
      createdAt: "",
      updatedAt: "",
    },
  }));
  await page.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 300));
  check("cancel sends nothing to the server", requests.length === 0);
  await client.send("Fetch.disable");
  await client.detach();

  await rail.click();
  await new Promise((r) => setTimeout(r, 200));
  await (await page.waitForSelector("aria/Save prompt", { timeout: 5000 })).click();
  await page.waitForSelector('aria/Prompt title[role="textbox"]', { timeout: 5000 });
  await page.keyboard.type(" (saved)");

  ({ client, requests } = await mockSavePromptApi(browser, () => ({
    status: 201,
    body: {
      id: "p2",
      title: `${ORIGINAL_PROMPT} (saved)`,
      text: ORIGINAL_PROMPT,
      model: null,
      category: null,
      tags: [],
      createdAt: "",
      updatedAt: "",
    },
  })));
  const confirmButton = await page.waitForSelector('aria/Save prompt[role="button"]', { timeout: 5000 });
  await confirmButton.click();
  await page.waitForFunction((button) => button.textContent?.trim() === "Saved", { timeout: 5000 }, confirmButton);
  check("saving reaches the server with the edited title", requests.length === 1, String(requests.length));
  const { "promptizer.librarySnapshot": unsyncedSnapshot } = await readStorage(browser, ["promptizer.librarySnapshot"]);
  check(
    "a save before any sync keeps the cache marked out of date",
    unsyncedSnapshot?.prompts?.length === 1 && unsyncedSnapshot.fetchedAt === 0,
    JSON.stringify(unsyncedSnapshot?.fetchedAt),
  );

  await new Promise((r) => setTimeout(r, 1500));
  const stillOpen = await confirmButton.evaluate(
    (btn) => btn.isConnected && getComputedStyle(btn).display !== "none" && btn.offsetParent !== null,
  );
  check("the confirmation closes the step on its own", !stillOpen);
  await client.detach();

  await setFirstSaveNoticeShown(browser, false);
  await rail.click();
  await new Promise((r) => setTimeout(r, 200));
  await (await page.waitForSelector("aria/Save prompt", { timeout: 5000 })).click();
  await page.waitForSelector('aria/Prompt title[role="textbox"]', { timeout: 5000 });

  ({ client, requests } = await mockSavePromptApi(browser, () => ({
    status: 201,
    body: {
      id: "p3",
      title: ORIGINAL_PROMPT,
      text: ORIGINAL_PROMPT,
      model: null,
      category: null,
      tags: [],
      createdAt: "",
      updatedAt: "",
    },
  })));
  const firstSaveConfirm = await page.waitForSelector('aria/Save prompt[role="button"]', { timeout: 5000 });
  await firstSaveConfirm.click();
  await page.waitForFunction(
    (btn) =>
      btn
        .closest(".pz-win")
        ?.querySelector('[role="status"]')
        ?.textContent?.includes("Stored in your Promptizer account"),
    { timeout: 5000 },
    firstSaveConfirm,
  );
  check("the first-ever save shows the account-storage notice", true);

  await new Promise((r) => setTimeout(r, 1500));
  const stillOpenAfterFirstSave = await firstSaveConfirm.evaluate(
    (btn) => btn.isConnected && btn.offsetParent !== null,
  );
  check("the first-save notice does not auto-close (stays until dismissed)", stillOpenAfterFirstSave);

  const doneButton = await page.waitForSelector('aria/Done[role="button"]', { timeout: 5000 });
  await doneButton.click();
  await new Promise((r) => setTimeout(r, 300));
  const closedAfterDone = await firstSaveConfirm.evaluate((btn) => !btn.isConnected || btn.offsetParent === null);
  check("dismissing the first-save notice closes the step", closedAfterDone);
  await client.detach();

  await rail.click();
  await new Promise((r) => setTimeout(r, 200));
  await (await page.waitForSelector("aria/Save prompt", { timeout: 5000 })).click();
  await page.waitForSelector('aria/Prompt title[role="textbox"]', { timeout: 5000 });

  await page.evaluate(() => {
    document.querySelector("#composer").textContent += " edited after the save step opened";
  });

  ({ client, requests } = await mockSavePromptApi(browser, () => ({
    status: 201,
    body: {
      id: "p4",
      title: ORIGINAL_PROMPT,
      text: ORIGINAL_PROMPT,
      model: null,
      category: null,
      tags: [],
      createdAt: "",
      updatedAt: "",
    },
  })));
  await (await page.waitForSelector('aria/Save prompt[role="button"]', { timeout: 5000 })).click();
  await new Promise((r) => setTimeout(r, 300));
  const sentBody = requests[0] ? JSON.parse(requests[0].body) : undefined;
  check(
    "editing the field after the save step opened does not change what gets sent",
    sentBody?.text === ORIGINAL_PROMPT,
    sentBody?.text,
  );
  await client.detach();
  await new Promise((r) => setTimeout(r, 1200));

  await rail.click();
  await new Promise((r) => setTimeout(r, 200));
  await (await page.waitForSelector("aria/Save prompt", { timeout: 5000 })).click();
  await page.waitForSelector('aria/Prompt title[role="textbox"]', { timeout: 5000 });

  await page.keyboard.type(" (retry)");
  const retryTitle = await (
    await page.waitForSelector('aria/Prompt title[role="textbox"]', { timeout: 5000 })
  ).evaluate((input) => input.value);
  const { [LIBRARY_STORAGE_KEY]: cacheBeforeFailure } = await readStorage(browser, [LIBRARY_STORAGE_KEY]);
  let serverReachable = false;
  ({ client, requests } = await mockSavePromptApi(browser, () =>
    serverReachable
      ? {
          status: 201,
          body: {
            id: "p-retry",
            title: retryTitle,
            text: ORIGINAL_PROMPT,
            model: null,
            category: null,
            tags: [],
            createdAt: "",
            updatedAt: "",
          },
        }
      : {
          status: 502,
          body: { code: "service_unavailable", message: "The service is unreachable. Please try again." },
        },
  ));
  const retryConfirm = await page.waitForSelector('aria/Save prompt[role="button"]', { timeout: 5000 });
  await retryConfirm.click();
  await page.waitForFunction(
    (btn, message) => btn.closest(".pz-win")?.querySelector('[role="alert"]')?.textContent === message,
    { timeout: 5000 },
    retryConfirm,
    UNREACHABLE_WRITE_MESSAGE,
  );
  check("a failed save says Promptizer couldn't be reached", true);
  const afterFailure = await retryConfirm.evaluate((btn) => ({
    label: btn.getAttribute("aria-label"),
    disabled: btn.disabled,
    open: btn.isConnected && btn.offsetParent !== null,
    title: btn.closest(".pz-win")?.querySelector('input[aria-label="Prompt title"]')?.value,
  }));
  check(
    "a failed save stays open with the typed title and offers Retry",
    afterFailure.open &&
      afterFailure.label === "Retry save" &&
      !afterFailure.disabled &&
      afterFailure.title === retryTitle,
    JSON.stringify(afterFailure),
  );
  const { [LIBRARY_STORAGE_KEY]: cacheAfterFailure } = await readStorage(browser, [LIBRARY_STORAGE_KEY]);
  check(
    "a failed save writes nothing to the cache",
    JSON.stringify(cacheAfterFailure) === JSON.stringify(cacheBeforeFailure),
  );

  serverReachable = true;
  await retryConfirm.click();
  await page.waitForFunction((btn) => btn.textContent?.trim() === "Saved", { timeout: 5000 }, retryConfirm);
  const retriedDrafts = requests.map((request) => JSON.parse(request.body));
  check(
    "Retry re-sends the same title and text and succeeds once the server recovers",
    retriedDrafts.length === 2 &&
      retriedDrafts[0].title === retryTitle &&
      retriedDrafts[0].text.startsWith(ORIGINAL_PROMPT) &&
      JSON.stringify(retriedDrafts[0]) === JSON.stringify(retriedDrafts[1]),
    JSON.stringify(retriedDrafts),
  );
  const { [LIBRARY_STORAGE_KEY]: cacheAfterRetry } = await readStorage(browser, [LIBRARY_STORAGE_KEY]);
  check(
    "the retried save lands in the cache exactly once",
    cacheAfterRetry?.prompts?.filter((prompt) => prompt.id === "p-retry").length === 1,
  );
  await client.detach();
  await new Promise((r) => setTimeout(r, 1200));

  await rail.click();
  await new Promise((r) => setTimeout(r, 200));
  await (await page.waitForSelector("aria/Save prompt", { timeout: 5000 })).click();
  await page.waitForSelector('aria/Prompt title[role="textbox"]', { timeout: 5000 });
  ({ client, requests } = await mockSavePromptApi(browser, () => ({
    status: 401,
    body: { code: "unauthenticated", message: "Unauthorized" },
  })));
  const signedOutConfirm = await page.waitForSelector('aria/Save prompt[role="button"]', { timeout: 5000 });
  await signedOutConfirm.click();
  await page.waitForFunction(
    (btn, message) => btn.closest(".pz-win")?.querySelector('[role="alert"]')?.textContent === message,
    { timeout: 5000 },
    signedOutConfirm,
    SIGNED_OUT_WRITE_MESSAGE,
  );
  const afterSignedOut = await signedOutConfirm.evaluate((btn) => ({
    label: btn.getAttribute("aria-label"),
    disabled: btn.disabled,
  }));
  check(
    "a 401 on save shows the signed-out message with no Retry",
    afterSignedOut.label === "Save prompt" && afterSignedOut.disabled && (await page.$("aria/Retry save")) === null,
    JSON.stringify(afterSignedOut),
  );
  await client.detach();

  await page.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 300));
  ({ client, requests } = await mockSavePromptApi(browser, () => ({
    status: 201,
    body: { id: "p5", title: "", text: "", model: null, category: null, tags: [], createdAt: "", updatedAt: "" },
  })));

  await page.setOfflineMode(true);
  await rail.click();
  await new Promise((r) => setTimeout(r, 200));
  const offlineRailSave = await page.waitForSelector('aria/Save prompt[role="menuitem"]', { timeout: 5000 });
  const offlineRailState = await offlineRailSave.evaluate((btn) => ({
    disabled: btn.getAttribute("aria-disabled"),
    tip: btn.dataset.tip,
  }));
  check(
    "offline, the rail's Save prompt is disabled with the read-only message",
    offlineRailState.disabled === "true" && offlineRailState.tip === OFFLINE_SAVE_MESSAGE,
    JSON.stringify(offlineRailState),
  );
  await offlineRailSave.click();
  await new Promise((r) => setTimeout(r, 300));
  check(
    "offline, activating Save prompt opens no save step",
    (await page.$('aria/Prompt title[role="textbox"]')) === null,
  );

  await page.setOfflineMode(false);
  await new Promise((r) => setTimeout(r, 200));
  const onlineRailDisabled = await offlineRailSave.evaluate((btn) => btn.getAttribute("aria-disabled"));
  check("coming back online re-enables Save prompt without a restart", onlineRailDisabled === null);
  await offlineRailSave.click();
  await page.waitForSelector('aria/Prompt title[role="textbox"]', { timeout: 5000 });
  check("back online, Save prompt opens the save step again", true);

  const stepSaveButton = await page.waitForSelector('aria/Save prompt[role="button"]', { timeout: 5000 });
  const offlineNoteShown = (btn) =>
    [...(btn.closest(".pz-win")?.querySelectorAll('[role="status"]') ?? [])].some(
      (node) => !node.hidden && node.textContent?.includes("You're offline"),
    );
  await page.setOfflineMode(true);
  await page.waitForFunction((btn) => btn.disabled, { timeout: 5000 }, stepSaveButton);
  check(
    "going offline while the save step is open disables Save and shows the read-only message",
    await stepSaveButton.evaluate(offlineNoteShown),
  );
  await stepSaveButton.evaluate((btn) => btn.click());
  await new Promise((r) => setTimeout(r, 300));
  check("offline, nothing is sent or queued", requests.length === 0, String(requests.length));

  await page.setOfflineMode(false);
  await page.waitForFunction((btn) => !btn.disabled, { timeout: 5000 }, stepSaveButton);
  check("back online, the open save step can save again", !(await stepSaveButton.evaluate(offlineNoteShown)));
  check("nothing queued while offline is sent on reconnect", requests.length === 0, String(requests.length));
  await page.keyboard.press("Escape");
  await client.detach();

  await page.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 300));
  await rail.click();
  await new Promise((r) => setTimeout(r, 200));
  await (await page.waitForSelector("aria/Save prompt", { timeout: 5000 })).click();
  await page.waitForSelector('aria/Prompt title[role="textbox"]', { timeout: 5000 });
  const held = await holdSavePromptApi(browser);
  await (await page.waitForSelector('aria/Save prompt[role="button"]', { timeout: 5000 })).click();
  await held.paused;
  await setStoredSession(browser, null);
  await browser.newPage().then(async (extensionPage) => {
    await extensionPage.goto(`chrome-extension://${extensionId()}/popup.html`);
    await extensionPage.evaluate(
      (keys) => chrome.storage.local.remove(keys),
      ["promptizer.librarySnapshot", FIRST_SAVE_NOTICE_KEY],
    );
    await extensionPage.close();
  });
  await held.release(201, {
    id: "p-late",
    title: ORIGINAL_PROMPT,
    text: ORIGINAL_PROMPT,
    model: null,
    category: null,
    tags: [],
    createdAt: "",
    updatedAt: "",
  });
  await new Promise((r) => setTimeout(r, 800));
  const afterSignOut = await readStorage(browser, ["promptizer.librarySnapshot", FIRST_SAVE_NOTICE_KEY]);
  check(
    "a save that finishes after sign-out writes nothing back into storage",
    Object.keys(afterSignOut).length === 0,
    JSON.stringify(Object.keys(afterSignOut)),
  );
  await held.client.detach();
});
