import { runCase, focusAndType, openRailOnRefine } from "../harness.mjs";

await runCase("chip-refine", async (page, check) => {
  await focusAndType(page);
  const refineLeaf = await openRailOnRefine(page);
  check("rail opens with Refine prompt leaf", refineLeaf !== null);

  await refineLeaf.click();
  const replaceBtn = await page.waitForSelector("aria/Replace text", { timeout: 5000 });
  check("loading -> result transition reaches Replace text", replaceBtn !== null);

  await replaceBtn.click();
  await new Promise((r) => setTimeout(r, 150));
  const editorText = await page.$eval("#composer", (el) => el.innerText);
  check("Replace writes refined text into editor", editorText.startsWith("Refined: "), editorText);
});
