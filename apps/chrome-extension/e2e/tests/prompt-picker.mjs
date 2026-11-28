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

const NOT_FOUND_EDIT_MESSAGE =
  "This prompt was deleted elsewhere, so it can't be saved. Copy your text if you still need it.";

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

async function readStorage(browser, keys) {
  const extensionPage = await browser.newPage();
  await extensionPage.goto(`chrome-extension://${extensionId()}/popup.html`);
  const stored = await extensionPage.evaluate((wanted) => chrome.storage.local.get(wanted), keys);
  await extensionPage.close();
  return stored;
}

async function mockPromptApi(browser, respond) {
  const workerTarget = await browser.waitForTarget((target) => target.type() === "service_worker", {
    timeout: 5000,
  });
  const client = await workerTarget.createCDPSession();
  const requests = [];
  await client.send("Fetch.enable", { patterns: [{ urlPattern: "*/api/prompts*", requestStage: "Request" }] });
  client.on("Fetch.requestPaused", async (event) => {
    requests.push({ url: event.request.url, method: event.request.method, body: event.request.postData });
    const outcome = await respond(event.request);
    await client.send("Fetch.fulfillRequest", {
      requestId: event.requestId,
      responseCode: outcome.status,
      responseHeaders: [{ name: "Content-Type", value: "application/json" }],
      body: Buffer.from(outcome.body === null ? "" : JSON.stringify(outcome.body)).toString("base64"),
    });
  });
  return { client, requests };
}

async function describedError(fieldHandle) {
  return fieldHandle.evaluate((field) => {
    const id = field.getAttribute("aria-describedby");
    return id === null ? null : (field.getRootNode().getElementById(id)?.textContent ?? null);
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

  const OFFLINE_SAVE_MESSAGE = "You're offline. Your library is read-only until you reconnect.";
  const serverEdited = {
    ...promptFixture("prompt-1", "Weekly summary (server)", WORK_PACK),
    text: "Weekly report text",
  };
  const api = await mockPromptApi(browser, (request) => {
    if (request.method === "DELETE") {
      return { status: 204, body: null };
    }
    if (request.url.endsWith("/api/prompts/prompt-2")) {
      return { status: 404, body: { code: "not_found", message: "Prompt not found." } };
    }
    const changes = JSON.parse(request.postData ?? "{}");
    if (changes.text === "rejected draft") {
      return {
        status: 422,
        body: {
          code: "validation_failed",
          message: "Please fix the highlighted fields.",
          fields: { text: "Text is not allowed." },
        },
      };
    }
    return { status: 200, body: serverEdited };
  });
  await page.bringToFront();
  let pickerSearch = await openPicker(page);
  await page.keyboard.type("weekly");
  await (await page.waitForSelector('aria/Edit selected prompt[role="button"]')).click();
  let titleField = await page.waitForSelector('aria/Prompt title[role="textbox"]', { timeout: 5000 });
  check(
    "Edit opens the selected prompt with its title focused and its text editable",
    (await focusedLabel(titleField)) === "Prompt title" &&
      (await titleField.evaluate((input) => input.value)) === "Weekly report" &&
      (await (await page.waitForSelector('aria/Prompt text[role="textbox"]')).evaluate((area) => area.value)) ===
        "Weekly report text",
  );
  await page.keyboard.type(" draft");
  await page.keyboard.press("Escape");
  check(
    "Escape cancels the edit back to the list with the search focused",
    (await focusedLabel(pickerSearch)) === "Search prompts" &&
      (await activeOptionLabel(pickerSearch)) === "Weekly report",
  );
  await (await page.waitForSelector('aria/Edit selected prompt[role="button"]')).click();
  await page.waitForSelector('aria/Prompt title[role="textbox"]', { timeout: 5000 });
  await (await page.waitForSelector('aria/Cancel edit[role="button"]')).click();
  check("cancelling an edit sends nothing to the server", api.requests.length === 0, String(api.requests.length));

  await (await page.waitForSelector('aria/Edit selected prompt[role="button"]')).click();
  titleField = await page.waitForSelector('aria/Prompt title[role="textbox"]', { timeout: 5000 });
  await titleField.evaluate((input) => input.select());
  await page.keyboard.type("Weekly summary");
  await (await page.waitForSelector('aria/Save changes[role="button"]')).click();
  check(
    "saving an edit lists the server-confirmed prompt in the picker",
    (await isShown(page, "Weekly summary (server)", 5000)) && !(await isShown(page, "Weekly report", 300)),
  );
  const patch = api.requests[0];
  check(
    "the edit is pushed as a PATCH with only the changed title",
    patch?.method === "PATCH" &&
      patch.url.endsWith("/api/prompts/prompt-1") &&
      patch.body === '{"title":"Weekly summary"}',
    JSON.stringify(patch),
  );
  const { [LIBRARY_STORAGE_KEY]: editedCache } = await readStorage(browser, [LIBRARY_STORAGE_KEY]);
  check(
    "the confirmed edit replaces the cached prompt",
    editedCache?.prompts?.find((prompt) => prompt.id === "prompt-1")?.title === "Weekly summary (server)",
  );

  await (await page.waitForSelector('aria/Edit selected prompt[role="button"]')).click();
  await page.waitForSelector('aria/Prompt title[role="textbox"]', { timeout: 5000 });
  const textField = await page.waitForSelector('aria/Prompt text[role="textbox"]');
  await textField.evaluate((area) => area.select());
  await textField.type("rejected draft");
  await (await page.waitForSelector('aria/Save changes[role="button"]')).click();
  await page.waitForFunction((area) => area.getAttribute("aria-invalid") === "true", { timeout: 5000 }, textField);
  check(
    "a server validation error shows inline next to the text field",
    (await describedError(textField)) === "Text is not allowed." && (await previewShows(page, "Text is not allowed.")),
  );
  check(
    "a rejected edit keeps the typed text and stays in the editor",
    (await textField.evaluate((area) => area.value)) === "rejected draft" &&
      (await focusedLabel(textField)) === "Prompt text",
  );
  await page.keyboard.press("Escape");
  check("the rejected text never reaches the picker", await isShown(page, "Weekly summary (server)"));

  const requestsBeforeDelete = api.requests.length;
  await (await page.waitForSelector('aria/Delete selected prompt[role="button"]')).click();
  const cancelDelete = await page.waitForSelector('aria/Cancel[role="button"]', { timeout: 5000 });
  check(
    "Delete asks for confirmation with the dashboard's wording before sending anything",
    (await previewShows(page, "Delete \u201cWeekly summary (server)\u201d?")) &&
      (await previewShows(page, "This permanently deletes the prompt and its text. This can't be undone.")) &&
      (await focusedLabel(cancelDelete)) === "Cancel" &&
      api.requests.length === requestsBeforeDelete,
  );
  await cancelDelete.click();
  check(
    "cancelling the confirmation keeps the prompt and sends nothing",
    (await isShown(page, "Weekly summary (server)")) && api.requests.length === requestsBeforeDelete,
  );
  await (await page.waitForSelector('aria/Delete selected prompt[role="button"]')).click();
  await (await page.waitForSelector('aria/Delete prompt[role="button"]', { timeout: 5000 })).click();
  check(
    "a confirmed delete removes the prompt from the picker",
    await page
      .waitForFunction(
        (input) => input.getRootNode().querySelector('[aria-label="Weekly summary (server)"]') === null,
        { timeout: 5000 },
        pickerSearch,
      )
      .then(() => true)
      .catch(() => false),
  );
  const deleteRequest = api.requests[requestsBeforeDelete];
  const { [LIBRARY_STORAGE_KEY]: deletedCache } = await readStorage(browser, [LIBRARY_STORAGE_KEY]);
  check(
    "the delete is pushed as a DELETE and the cache drops the prompt and its pack count",
    deleteRequest?.method === "DELETE" &&
      deletedCache?.prompts?.every((prompt) => prompt.id !== "prompt-1") &&
      deletedCache?.packs?.[0]?.promptCount === 1,
    JSON.stringify(deleteRequest),
  );
  await page.keyboard.press("Escape");

  await openPicker(page);
  await page.keyboard.type("standup");
  await (await page.waitForSelector('aria/Edit selected prompt[role="button"]')).click();
  await page.waitForSelector('aria/Prompt title[role="textbox"]', { timeout: 5000 });
  const goneTextField = await page.waitForSelector('aria/Prompt text[role="textbox"]');
  await goneTextField.evaluate((area) => area.select());
  await goneTextField.type("standup kept locally");
  const goneSave = await page.waitForSelector('aria/Save changes[role="button"]');
  await goneSave.click();
  await page.waitForFunction(
    (saveButton) => saveButton.getRootNode().querySelector(".pz-picker")?.textContent?.includes("deleted elsewhere"),
    { timeout: 5000 },
    goneSave,
  );
  const { [LIBRARY_STORAGE_KEY]: goneCache } = await readStorage(browser, [LIBRARY_STORAGE_KEY]);
  check(
    "an edit of a prompt deleted elsewhere says so, keeps the text, and stops offering Save",
    (await previewShows(page, NOT_FOUND_EDIT_MESSAGE)) &&
      (await goneTextField.evaluate((area) => area.value)) === "standup kept locally" &&
      (await goneSave.evaluate((saveButton) => saveButton.disabled)) &&
      goneCache?.prompts?.every((prompt) => prompt.id !== "prompt-2"),
  );
  await page.keyboard.press("Escape");
  check("the prompt deleted elsewhere leaves the picker", !(await isShown(page, "Standup notes", 300)));
  await page.keyboard.press("Escape");
  await api.client.detach();

  pickerSearch = await openPicker(page);
  await page.keyboard.type("bug");
  await (await page.waitForSelector('aria/Edit selected prompt[role="button"]')).click();
  const saveEdit = await page.waitForSelector('aria/Save changes[role="button"]', { timeout: 5000 });
  await page.setOfflineMode(true);
  await page.waitForFunction((saveButton) => saveButton.disabled, { timeout: 5000 }, saveEdit);
  check(
    "going offline mid-edit disables Save and shows the read-only message",
    await previewShows(page, OFFLINE_SAVE_MESSAGE),
  );
  await page.keyboard.press("Escape");
  const offlineActions = await pickerSearch.evaluate((input) =>
    [...input.getRootNode().querySelectorAll(".pz-picker .pz-win__bar--bottom button")].map((actionButton) => ({
      disabled: actionButton.disabled,
      title: actionButton.title,
    })),
  );
  check(
    "offline, Edit and Delete are disabled with the read-only message",
    offlineActions.length === 2 &&
      offlineActions.every((action) => action.disabled && action.title === OFFLINE_SAVE_MESSAGE),
    JSON.stringify(offlineActions),
  );
  await page.setOfflineMode(false);
  await page.waitForFunction(
    (input) =>
      [...input.getRootNode().querySelectorAll(".pz-picker .pz-win__bar--bottom button")].every(
        (actionButton) => !actionButton.disabled,
      ),
    { timeout: 5000 },
    pickerSearch,
  );
  check("back online, Edit and Delete are available again", true);
  await page.keyboard.press("Escape");

  const UNREACHABLE_WRITE_MESSAGE = "Couldn't reach Promptizer, so nothing changed. Check your connection and retry.";
  const SIGNED_OUT_WRITE_MESSAGE = "Your Promptizer session ended. Sign in again from the Promptizer popup.";
  const REJECTED_WRITE_MESSAGE = "Promptizer couldn't accept this change. Your text is still here.";
  let releaseHeldDelete = () => {};
  const heldDeleteReply = new Promise((resolve) => {
    releaseHeldDelete = () => resolve({ status: 409, body: { code: "conflict" } });
  });
  const serverRenamed = {
    ...promptFixture("prompt-2", "Standup agenda (server)", WORK_PACK),
    text: "Standup notes text",
  };
  let promptServerMode = "unreachable";
  const flakyApi = await mockPromptApi(browser, (request) => {
    if (promptServerMode === "unreachable") {
      return { status: 503, body: { code: "service_unavailable", message: "The service is unreachable." } };
    }
    if (promptServerMode === "signed-out") {
      return { status: 401, body: { code: "unauthenticated", message: "Unauthorized" } };
    }
    if (promptServerMode === "conflict" && request.method === "DELETE") {
      return heldDeleteReply;
    }
    if (promptServerMode === "conflict") {
      return { status: 409, body: { code: "conflict" } };
    }
    return request.method === "DELETE" ? { status: 204, body: null } : { status: 200, body: serverRenamed };
  });
  await writeStorage(browser, { [LIBRARY_STORAGE_KEY]: FULL_LIBRARY });
  await page.bringToFront();
  pickerSearch = await openPicker(page);
  await page.keyboard.type("standup");
  await (await page.waitForSelector('aria/Edit selected prompt[role="button"]')).click();
  titleField = await page.waitForSelector('aria/Prompt title[role="textbox"]', { timeout: 5000 });
  await titleField.evaluate((input) => input.select());
  await page.keyboard.type("Standup agenda");
  const { [LIBRARY_STORAGE_KEY]: cacheBeforeFailures } = await readStorage(browser, [LIBRARY_STORAGE_KEY]);
  const saveChanges = await page.waitForSelector('aria/Save changes[role="button"]');
  await saveChanges.click();
  await page.waitForFunction(
    (saveButton) => saveButton.getAttribute("aria-label") === "Retry save" && !saveButton.disabled,
    { timeout: 5000 },
    saveChanges,
  );
  check(
    "a network failure on edit says Promptizer couldn't be reached, keeps the typed title and offers Retry",
    (await previewShows(page, UNREACHABLE_WRITE_MESSAGE)) &&
      (await titleField.evaluate((input) => input.value)) === "Standup agenda",
  );
  const { [LIBRARY_STORAGE_KEY]: cacheAfterEditFailure } = await readStorage(browser, [LIBRARY_STORAGE_KEY]);
  check(
    "a failed edit leaves the cache untouched",
    JSON.stringify(cacheAfterEditFailure) === JSON.stringify(cacheBeforeFailures),
  );

  promptServerMode = "reachable";
  await saveChanges.click();
  check(
    "Retry after the server recovers lists the server-confirmed edit",
    (await isShown(page, "Standup agenda (server)", 5000)) && !(await isShown(page, "Standup notes", 300)),
  );
  const retriedEdits = flakyApi.requests.map((request) => request.body);
  const { [LIBRARY_STORAGE_KEY]: cacheAfterEditRetry } = await readStorage(browser, [LIBRARY_STORAGE_KEY]);
  check(
    "the retried edit re-sends the same change and the cache reflects the server",
    retriedEdits.length === 2 &&
      retriedEdits.every((body) => body === '{"title":"Standup agenda"}') &&
      cacheAfterEditRetry?.prompts?.find((prompt) => prompt.id === "prompt-2")?.title === "Standup agenda (server)",
    JSON.stringify(retriedEdits),
  );

  promptServerMode = "signed-out";
  await (await page.waitForSelector('aria/Delete selected prompt[role="button"]')).click();
  const deleteButton = await page.waitForSelector('aria/Delete prompt[role="button"]', { timeout: 5000 });
  await deleteButton.click();
  await page.waitForFunction(
    (button) => button.getAttribute("aria-label") === "Delete prompt" && button.disabled,
    { timeout: 5000 },
    deleteButton,
  );
  check(
    "a 401 on delete shows the signed-out message, not the network one, with no Retry",
    (await previewShows(page, SIGNED_OUT_WRITE_MESSAGE)) &&
      !(await previewShows(page, UNREACHABLE_WRITE_MESSAGE)) &&
      !(await isShown(page, "Retry delete", 300)),
  );
  await (await page.waitForSelector('aria/Cancel[role="button"]')).click();

  promptServerMode = "unreachable";
  const { [LIBRARY_STORAGE_KEY]: cacheBeforeDeleteFailure } = await readStorage(browser, [LIBRARY_STORAGE_KEY]);
  await (await page.waitForSelector('aria/Delete selected prompt[role="button"]')).click();
  const retryableDelete = await page.waitForSelector('aria/Delete prompt[role="button"]', { timeout: 5000 });
  await retryableDelete.click();
  await page.waitForFunction(
    (button) => button.getAttribute("aria-label") === "Retry delete" && !button.disabled,
    { timeout: 5000 },
    retryableDelete,
  );
  const { [LIBRARY_STORAGE_KEY]: cacheAfterDeleteFailure } = await readStorage(browser, [LIBRARY_STORAGE_KEY]);
  check(
    "a network failure on delete offers Retry and keeps the prompt in the cache",
    (await previewShows(page, UNREACHABLE_WRITE_MESSAGE)) &&
      JSON.stringify(cacheAfterDeleteFailure) === JSON.stringify(cacheBeforeDeleteFailure),
  );

  promptServerMode = "reachable";
  await retryableDelete.click();
  check(
    "Retry delete after the server recovers removes the prompt from the picker",
    await page
      .waitForFunction(
        (input) => input.getRootNode().querySelector('[aria-label="Standup agenda (server)"]') === null,
        { timeout: 5000 },
        pickerSearch,
      )
      .then(() => true)
      .catch(() => false),
  );
  const { [LIBRARY_STORAGE_KEY]: cacheAfterDeleteRetry } = await readStorage(browser, [LIBRARY_STORAGE_KEY]);
  check(
    "the retried delete drops the prompt from the cache",
    cacheAfterDeleteRetry?.prompts?.every((prompt) => prompt.id !== "prompt-2") &&
      flakyApi.requests.filter((request) => request.method === "DELETE").length === 3,
  );

  promptServerMode = "conflict";
  await page.keyboard.press("Escape");
  pickerSearch = await openPicker(page);
  await page.keyboard.type("bug");
  await (await page.waitForSelector('aria/Edit selected prompt[role="button"]')).click();
  titleField = await page.waitForSelector('aria/Prompt title[role="textbox"]', { timeout: 5000 });
  await titleField.evaluate((input) => input.select());
  await page.keyboard.type("Bug triage v2");
  const conflictingSave = await page.waitForSelector('aria/Save changes[role="button"]');
  await conflictingSave.click();
  await page.waitForFunction(
    (saveButton, message) => saveButton.getRootNode().querySelector(".pz-picker")?.textContent?.includes(message),
    { timeout: 5000 },
    conflictingSave,
    REJECTED_WRITE_MESSAGE,
  );
  check(
    "a 409 on edit says Promptizer couldn't accept the change, keeps the typed title and offers no Retry",
    (await previewShows(page, REJECTED_WRITE_MESSAGE)) &&
      !(await previewShows(page, UNREACHABLE_WRITE_MESSAGE)) &&
      !(await isShown(page, "Retry save", 300)) &&
      (await titleField.evaluate((input) => input.value)) === "Bug triage v2" &&
      (await focusedLabel(titleField)) === "Cancel edit",
  );
  await (await page.waitForSelector('aria/Cancel edit[role="button"]')).click();

  await (await page.waitForSelector('aria/Delete selected prompt[role="button"]')).click();
  const conflictingDelete = await page.waitForSelector('aria/Delete prompt[role="button"]', { timeout: 5000 });
  await conflictingDelete.click();
  const isDeletingVisibly = await page
    .waitForFunction(
      (input) => {
        const panel = input.getRootNode().querySelector(".pz-picker__panel");
        return panel?.getAttribute("aria-busy") === "true" && panel.innerText.includes("Deleting…");
      },
      { timeout: 5000 },
      pickerSearch,
    )
    .then(() => true)
    .catch(() => false);
  check("while a delete is in flight the confirm panel shows Deleting… and is marked busy", isDeletingVisibly);
  releaseHeldDelete();
  await page.waitForFunction(
    (button) => button.getAttribute("aria-label") === "Delete prompt" && button.disabled,
    { timeout: 5000 },
    conflictingDelete,
  );
  const { [LIBRARY_STORAGE_KEY]: cacheAfterRejectedDelete } = await readStorage(browser, [LIBRARY_STORAGE_KEY]);
  check(
    "a 409 on delete shows the rejected message with no Retry and keeps the prompt in the cache",
    (await previewShows(page, REJECTED_WRITE_MESSAGE)) &&
      !(await isShown(page, "Retry delete", 300)) &&
      (await pickerSearch.evaluate(
        (input) => input.getRootNode().querySelector(".pz-picker__panel")?.hasAttribute("aria-busy") === false,
      )) &&
      cacheAfterRejectedDelete?.prompts?.some((prompt) => prompt.id === "prompt-3"),
  );
  await (await page.waitForSelector('aria/Cancel[role="button"]')).click();
  await page.keyboard.press("Escape");
  await flakyApi.client.detach();

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
