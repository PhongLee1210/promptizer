import { runCase, extensionId, focusAndType, ORIGINAL_PROMPT } from "../harness.mjs";

const SESSION_STORAGE_KEY = "promptizer.accountSession";
const SIGNED_IN_STORAGE_KEY = "promptizer.signedIn";
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

async function mockSavePromptApi(browser, respond) {
  const workerTarget = await browser.waitForTarget((target) => target.type() === "service_worker", {
    timeout: 5000,
  });
  const client = await workerTarget.createCDPSession();
  const requests = [];
  await client.send("Fetch.enable", { patterns: [{ urlPattern: "*/api/prompts*", requestStage: "Request" }] });
  client.on("Fetch.requestPaused", async (event) => {
    requests.push(event.request.url);
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

await runCase("save-prompt", async (page, check, browser) => {
  await setStoredSession(browser, STORED_SESSION);
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

  await new Promise((r) => setTimeout(r, 1500));
  const stillOpen = await confirmButton.evaluate(
    (btn) => btn.isConnected && getComputedStyle(btn).display !== "none" && btn.offsetParent !== null,
  );
  check("the confirmation closes the step on its own", !stillOpen);
  await client.detach();
});
