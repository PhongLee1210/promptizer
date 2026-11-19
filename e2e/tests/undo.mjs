import { runCase, focusAndType, openRailOnRefine, ORIGINAL_PROMPT } from "../harness.mjs";

await runCase("undo", async (page, check) => {
  await focusAndType(page);
  const refineLeaf = await openRailOnRefine(page);
  await refineLeaf.click();
  const replaceBtn = await page.waitForSelector("aria/Replace text", { timeout: 5000 });
  await replaceBtn.click();

  const undoBtn = await page.waitForSelector("aria/Undo replace", { timeout: 3000 });
  check("Undo button appears inside 6s window", undoBtn !== null);

  await undoBtn.click();
  await new Promise((r) => setTimeout(r, 150));
  const editorText = await page.$eval("#composer", (el) => el.innerText);
  check("Undo restores original text", editorText === ORIGINAL_PROMPT, editorText);
});
