import { runCase, extensionId, findAccessibleName } from "../harness.mjs";

const SESSION_STORAGE_KEY = "promptizer.accountSession";
const SIGNED_IN_STORAGE_KEY = "promptizer.signedIn";
const LIBRARY_STORAGE_KEY = "promptizer.librarySnapshot";
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

function storedSession() {
  return {
    accessToken: "access-token",
    refreshToken: "refresh-token",
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    user: { id: "user-1", email: "ada@example.com", name: "Ada" },
  };
}

function storedLibrary(prompts, packs) {
  return { prompts, packs, fetchedAt: Math.floor(Date.now() / 1000) };
}

const FULL_LIBRARY = storedLibrary(
  [
    promptFixture("prompt-1", "Weekly report", WORK_PACK),
    promptFixture("prompt-2", "Standup notes", WORK_PACK),
    promptFixture("prompt-3", "Bug triage", null),
  ],
  [{ ...WORK_PACK, promptCount: 2 }],
);

async function writeStorage(browser, entries) {
  const extensionPage = await browser.newPage();
  await extensionPage.goto(`chrome-extension://${extensionId()}/popup.html`);
  await extensionPage.evaluate((values) => chrome.storage.local.set(values), entries);
  await extensionPage.close();
}

async function isShown(page, label, timeoutMs = 1000) {
  try {
    await page.waitForSelector(`aria/${label}`, { timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

async function focusedLabel(handle) {
  return handle.evaluate((node) => {
    const active = node.getRootNode().activeElement;
    return active?.getAttribute("aria-label") ?? null;
  });
}

async function openPicker(page, editorSelector = "#composer") {
  await page.click(editorSelector);
  await new Promise((resolve) => setTimeout(resolve, 200));
  await (await page.waitForSelector("aria/Promptizer actions", { timeout: 5000 })).click();
  await new Promise((resolve) => setTimeout(resolve, 200));
  await (await page.waitForSelector("aria/My Prompts", { timeout: 5000 })).click();
  return page.waitForSelector("aria/Search prompts", { timeout: 5000 });
}

async function pickBySearch(page, query) {
  await openPicker(page);
  await page.keyboard.type(query);
  await page.keyboard.press("Enter");
  return page.waitForSelector("aria/Replace text", { timeout: 5000 });
}

async function previewShows(page, text) {
  const snapshot = await page.accessibility.snapshot({ interestingOnly: false });
  return findAccessibleName(snapshot, (name) => name === text) !== null;
}

async function historyTotal(page) {
  const snapshot = await page.accessibility.snapshot({ interestingOnly: false });
  const counter = findAccessibleName(snapshot, (name) => /^\d+\/\d+$/.test(name));
  return counter === null ? null : Number(counter.split("/")[1]);
}

async function activeOptionLabel(searchHandle) {
  return searchHandle.evaluate((input) => {
    const id = input.getAttribute("aria-activedescendant");
    return id === null ? null : input.getRootNode().getElementById(id)?.getAttribute("aria-label");
  });
}

await runCase("prompt-picker", async (page, check, browser) => {
  await writeStorage(browser, {
    [SESSION_STORAGE_KEY]: storedSession(),
    [SIGNED_IN_STORAGE_KEY]: true,
    [LIBRARY_STORAGE_KEY]: FULL_LIBRARY,
  });
  await page.bringToFront();

  const search = await openPicker(page);
  check("My Prompts opens the picker with the search field focused", (await focusedLabel(search)) === "Search prompts");
  check("picker lists packs with their counts", await isShown(page, "Work pack, 2 prompts"));
  check("picker lists every prompt at the top level", await isShown(page, "Bug triage"));

  await page.keyboard.type("bug");
  check(
    "search filters prompts by title",
    (await isShown(page, "Bug triage")) && !(await isShown(page, "Weekly report", 300)),
  );
  await page.keyboard.type("zzz");
  const noMatchSnapshot = await page.accessibility.snapshot({ interestingOnly: false });
  check(
    "a search with no match says so",
    findAccessibleName(noMatchSnapshot, (name) => name === 'No prompts match "bugzzz".') !== null,
  );

  await search.evaluate((input) => {
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  check("the first row starts active", (await activeOptionLabel(search)) === "Work pack, 2 prompts");
  await page.keyboard.press("End");
  check("End moves to the last row", (await activeOptionLabel(search)) === "Weekly report");
  await page.keyboard.press("ArrowDown");
  check("ArrowDown wraps to the first row", (await activeOptionLabel(search)) === "Work pack, 2 prompts");

  await page.keyboard.press("Enter");
  check(
    "Enter on a pack shows only that pack's prompts",
    (await isShown(page, "Standup notes")) && !(await isShown(page, "Bug triage", 300)),
  );

  await page.keyboard.press("Escape");
  check("Escape inside a pack returns to all packs", await isShown(page, "Work pack, 2 prompts"));

  await page.keyboard.press("Escape");
  check("Escape at the top level closes the picker", !(await isShown(page, "Search prompts", 500)));
  const trigger = await page.waitForSelector("aria/Promptizer actions");
  check("closing the picker returns focus to the chip", (await focusedLabel(trigger)) === "Promptizer actions");

  const replaceButton = await pickBySearch(page, "bug");
  check("picking a prompt shows its text in the editable preview", await previewShows(page, "Bug triage text"));
  check("a picked prompt offers no Regenerate", !(await isShown(page, "Regenerate", 300)));
  await replaceButton.click();
  await new Promise((resolve) => setTimeout(resolve, 200));
  const composerText = () => page.$eval("#composer", (composer) => composer.innerText.trim());
  check("Replace writes the picked prompt into the composer", (await composerText()) === "Bug triage text");

  await pickBySearch(page, "weekly");
  await (await page.waitForSelector("aria/Close")).click();
  await new Promise((resolve) => setTimeout(resolve, 200));
  check("dismissing the preview leaves the composer untouched", (await composerText()) === "Bug triage text");

  const textareaPage = await browser.newPage();
  await textareaPage.goto(page.url(), { waitUntil: "networkidle0" });
  await textareaPage.evaluate(() => {
    const textarea = document.createElement("textarea");
    textarea.id = "plain-textarea";
    document.body.append(textarea);
  });
  await openPicker(textareaPage, "#plain-textarea");
  await textareaPage.keyboard.type("standup");
  await textareaPage.keyboard.press("Enter");
  await (await textareaPage.waitForSelector("aria/Replace text", { timeout: 5000 })).click();
  await new Promise((resolve) => setTimeout(resolve, 200));
  check(
    "insert also works in a plain textarea",
    (await textareaPage.$eval("#plain-textarea", (textarea) => textarea.value)) === "Standup notes text",
  );
  await textareaPage.close();

  await page.click("#composer");
  await (await page.waitForSelector("aria/Promptizer actions")).click();
  await (await page.waitForSelector("aria/Recent results", { timeout: 5000 })).click();
  const historyBeforePick = await historyTotal(page);
  await (await page.waitForSelector("aria/Close")).click();
  await new Promise((resolve) => setTimeout(resolve, 200));

  await page.$eval("#composer", (composer) => {
    composer.innerText = "";
  });
  await page.type("#composer", "slow request");
  await (await page.waitForSelector("aria/Promptizer actions")).click();
  await new Promise((resolve) => setTimeout(resolve, 200));
  await (await page.waitForSelector("aria/Fix grammar", { timeout: 5000 })).click();
  await (await page.waitForSelector("aria/Promptizer actions")).click();
  await new Promise((resolve) => setTimeout(resolve, 200));
  await (await page.waitForSelector("aria/Promptizer actions")).click();
  await new Promise((resolve) => setTimeout(resolve, 200));
  await (await page.waitForSelector("aria/My Prompts", { timeout: 5000 })).click();
  await page.waitForSelector("aria/Search prompts", { timeout: 5000 });
  await page.keyboard.type("bug");
  const bugRow = await page.waitForSelector("aria/Bug triage");
  await bugRow.evaluate((row) => {
    row.click();
    row.click();
  });
  await new Promise((resolve) => setTimeout(resolve, 2000));
  check(
    "a late model answer cannot replace a picked prompt's preview",
    (await previewShows(page, "Bug triage text")) && !(await previewShows(page, "Slow request.")),
  );
  const historyAfterPick = await historyTotal(page);
  check(
    "a duplicate pick adds a single preview entry",
    historyAfterPick === historyBeforePick + 1,
    `${historyBeforePick} -> ${historyAfterPick}`,
  );
  await (await page.waitForSelector("aria/Close")).click();
  await new Promise((resolve) => setTimeout(resolve, 200));

  const offlineMessage = "You're offline. Showing your last synced library.";
  await page.bringToFront();
  await page.setOfflineMode(true);
  await openPicker(page);
  check(
    "offline, the picker opens from the cache and says it is offline",
    (await isShown(page, "Weekly report")) && (await previewShows(page, offlineMessage)),
  );
  await page.setOfflineMode(false);
  await new Promise((resolve) => setTimeout(resolve, 300));
  check("coming back online clears the offline note without a restart", !(await previewShows(page, offlineMessage)));
  await page.setOfflineMode(true);
  await page.keyboard.type("weekly");
  await page.keyboard.press("Enter");
  await (await page.waitForSelector("aria/Replace text", { timeout: 5000 })).click();
  await new Promise((resolve) => setTimeout(resolve, 200));
  check("offline, a picked prompt still inserts", (await composerText()) === "Weekly report text");
  await page.setOfflineMode(false);

  await writeStorage(browser, { [LIBRARY_STORAGE_KEY]: storedLibrary([], []) });
  await page.bringToFront();
  await openPicker(page);
  check(
    "an empty library shows the honest empty state with a dashboard pointer",
    (await isShown(page, "Open dashboard")) && !(await isShown(page, "Bug triage", 300)),
  );

  await page.keyboard.press("Escape");
  await page.$eval("#composer", (composer) => {
    composer.innerText = "";
  });
  await page.type("#composer", "slow again");
  await (await page.waitForSelector("aria/Promptizer actions")).click();
  await new Promise((resolve) => setTimeout(resolve, 200));
  await (await page.waitForSelector("aria/Fix grammar", { timeout: 5000 })).click();
  await (await page.waitForSelector("aria/Promptizer actions")).click();
  await new Promise((resolve) => setTimeout(resolve, 200));
  await (await page.waitForSelector("aria/Promptizer actions")).click();
  await new Promise((resolve) => setTimeout(resolve, 200));
  await (await page.waitForSelector("aria/My Prompts", { timeout: 5000 })).click();
  await new Promise((resolve) => setTimeout(resolve, 2000));
  check(
    "a late model answer cannot replace an open picker",
    (await isShown(page, "Search prompts")) && !(await isShown(page, "Replace text", 300)),
  );

  await writeStorage(browser, { [SIGNED_IN_STORAGE_KEY]: false });
  await page.bringToFront();
  check("signing out closes an open picker", !(await isShown(page, "Search prompts", 1000)));
});
