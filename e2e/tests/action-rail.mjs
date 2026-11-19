import { runCase, focusAndType, findAccessibleName, ORIGINAL_PROMPT } from "../harness.mjs";

async function openRail(page) {
  const chip = await page.waitForSelector("aria/Promptizer actions", { timeout: 5000 });
  await chip.click();
  await new Promise((r) => setTimeout(r, 200));
  return chip;
}

async function closeResult(page) {
  const closeBtn = await page.waitForSelector("aria/Close", { timeout: 5000 });
  await closeBtn.click();
  await new Promise((r) => setTimeout(r, 200));
}

await runCase("action-rail", async (page, check) => {
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
});
