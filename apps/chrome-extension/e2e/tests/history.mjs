import { runCase, focusAndType, openRailOnRefine, findAccessibleName, ORIGINAL_PROMPT } from "../harness.mjs";

async function readCounter(page) {
  const snapshot = await page.accessibility.snapshot({ interestingOnly: false });
  return findAccessibleName(snapshot, (name) => /^\d+\/\d+$/.test(name));
}

await runCase("history", async (page, check) => {
  await focusAndType(page);
  const refineLeaf = await openRailOnRefine(page);
  await refineLeaf.click();
  await page.waitForSelector("aria/Replace text", { timeout: 6000 });

  const counter1 = await readCounter(page);
  check("first result shows counter 1/1", counter1 === "1/1", `got "${counter1}"`);

  const regenerate = await page.waitForSelector("aria/Regenerate", { timeout: 5000 });
  await regenerate.click();
  let counter2 = null;
  for (let i = 0; i < 30; i++) {
    counter2 = await readCounter(page);
    if (counter2 === "2/2") break;
    await new Promise((r) => setTimeout(r, 200));
  }
  check("regenerate appends second result, counter 2/2", counter2 === "2/2", `got "${counter2}"`);

  const prev = await page.waitForSelector("aria/Previous result", { timeout: 5000 });
  await prev.click();
  let counter3 = null;
  for (let i = 0; i < 20; i++) {
    counter3 = await readCounter(page);
    if (counter3 === "1/2") break;
    await new Promise((r) => setTimeout(r, 200));
  }
  check("prev steps back to 1/2", counter3 === "1/2", `got "${counter3}"`);

  const deleteBtn = await page.waitForSelector("aria/Delete result", { timeout: 5000 });
  await deleteBtn.click();
  let counter4 = null;
  for (let i = 0; i < 20; i++) {
    counter4 = await readCounter(page);
    if (counter4 === "1/1") break;
    await new Promise((r) => setTimeout(r, 200));
  }
  check("delete current drops entry, counter 1/1", counter4 === "1/1", `got "${counter4}"`);

  const replaceInWindow = await page.waitForSelector("aria/Replace text", { timeout: 5000 });
  await replaceInWindow.focus();
  await page.keyboard.press("Escape");
  await page.waitForSelector("aria/Replace text", { hidden: true, timeout: 5000 });
  const trigger = await page.waitForSelector("aria/Promptizer actions", { timeout: 5000 });
  await trigger.click();
  const recent = await page.waitForSelector("aria/Recent results", { timeout: 5000 });
  await recent.click();
  const replace = await page.waitForSelector("aria/Replace text", { timeout: 5000 });
  await replace.click();
  let composerText = ORIGINAL_PROMPT;
  for (let i = 0; i < 20; i++) {
    composerText = await page.$eval("#composer", (composer) => composer.innerText.trim());
    if (composerText !== ORIGINAL_PROMPT) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  check(
    "replace from recent results after dismiss writes into the composer",
    composerText !== ORIGINAL_PROMPT,
    `composer="${composerText}"`,
  );
});
