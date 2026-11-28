import { runCase, focusAndType, findAccessibleName, extensionId, ORIGINAL_PROMPT } from "../harness.mjs";

const SESSION_STORAGE_KEY = "promptizer.accountSession";
const SIGNED_IN_STORAGE_KEY = "promptizer.signedIn";
const STORED_SESSION = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
  user: { id: "user-1", email: "ada@example.com", name: "Ada" },
};

async function openRail(page) {
  const chip = await page.waitForSelector("aria/Promptizer actions", { timeout: 5000 });
  await chip.click();
  await new Promise((r) => setTimeout(r, 200));
  return chip;
}

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

async function railHasItem(page, label) {
  try {
    await page.waitForSelector(`aria/${label}`, { timeout: 1000 });
    return true;
  } catch {
    return false;
  }
}

async function closeResult(page) {
  const closeBtn = await page.waitForSelector("aria/Close", { timeout: 5000 });
  await closeBtn.click();
  await new Promise((r) => setTimeout(r, 200));
}

await runCase("action-rail", async (page, check, browser) => {
  await focusAndType(page);

  // Test A: a plain top-level leaf (not refine) runs end-to-end on the ORIGINAL prompt.
  await openRail(page);
  const grammarLeaf = await page.waitForSelector("aria/Fix grammar", { timeout: 5000 });
  check("rail exposes the Fix grammar leaf", grammarLeaf !== null);

  await grammarLeaf.click();
  await page.waitForSelector("aria/Replace text", { timeout: 5000 });
  const grammarSnapshot = await page.accessibility.snapshot({ interestingOnly: false });
  const expectedGrammarFix = `${ORIGINAL_PROMPT.charAt(0).toUpperCase()}${ORIGINAL_PROMPT.slice(1)}.`;
  const grammarResult = findAccessibleName(grammarSnapshot, (name) => name === expectedGrammarFix);
  check("Fix grammar leaf runs the grammar-fix action on the original prompt", grammarResult !== null, grammarResult);

  await closeResult(page);

  // Test B: a sub-menu leaf (translate -> Vietnamese) runs end-to-end on the ORIGINAL prompt.
  await openRail(page);
  const translateGroup = await page.waitForSelector("aria/Translate", { timeout: 5000 });
  await translateGroup.click();
  const viLeaf = await page.waitForSelector("aria/Vietnamese", { timeout: 3000 });
  check("Translate group reveals the Vietnamese leaf", viLeaf !== null);

  await viLeaf.click();
  await page.waitForSelector("aria/Replace text", { timeout: 5000 });
  const viSnapshot = await page.accessibility.snapshot({ interestingOnly: false });
  const viResult = findAccessibleName(viSnapshot, (name) => name.startsWith("Ban tieng Viet: "));
  check("Vietnamese leaf runs the translate action on the original prompt", viResult !== null, viResult);

  await closeResult(page);

  // Test C: keyboard navigation moves focus between top-level rail items.
  await openRail(page);
  const grammarHandle = await page.waitForSelector("aria/Fix grammar", { timeout: 5000 });
  const activeLabel = () =>
    grammarHandle.evaluate((el) => el.getRootNode().activeElement?.getAttribute("aria-label") ?? null);

  check("opening the rail focuses the first item (Refine prompt)", (await activeLabel()) === "Refine prompt");

  await page.keyboard.press("ArrowDown");
  check("ArrowDown moves focus to the next item (Fix grammar)", (await activeLabel()) === "Fix grammar");

  await page.keyboard.press("ArrowDown");
  check("ArrowDown again moves focus to Shorten", (await activeLabel()) === "Shorten");

  await page.keyboard.press("Home");
  check("Home returns focus to the first item (Refine prompt)", (await activeLabel()) === "Refine prompt");

  await page.keyboard.press("End");
  check("End moves focus to the last item (Turn off)", (await activeLabel()) === "Turn off");

  // Test D: Escape closes the rail without activating anything.
  await page.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 200));
  let escapeClosedRail = false;
  try {
    await page.waitForSelector("aria/Refine prompt", { timeout: 1000 });
  } catch {
    escapeClosedRail = true;
  }
  check("Escape closes the rail", escapeClosedRail);

  await openRail(page);
  check("signed-out rail never shows My Prompts", !(await railHasItem(page, "My Prompts")));
  await page.keyboard.press("Escape");

  await setStoredSession(browser, STORED_SESSION);
  await page.bringToFront();
  await page.click("#composer");
  await openRail(page);
  check("signed-in rail shows My Prompts without a reload", await railHasItem(page, "My Prompts"));

  await page.keyboard.press("End");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  const myPromptsHandle = await page.waitForSelector("aria/My Prompts");
  const focusedLabel = await myPromptsHandle.evaluate(
    (node) => node.getRootNode().activeElement?.getAttribute("aria-label") ?? null,
  );
  check(
    "My Prompts joins the rail's keyboard order before Recent results",
    focusedLabel === "My Prompts",
    focusedLabel,
  );

  await page.keyboard.press("Escape");

  await setStoredSession(browser, null);
  await page.bringToFront();
  await page.click("#composer");
  await openRail(page);
  check("signing out removes My Prompts from the rail", !(await railHasItem(page, "My Prompts")));
});
