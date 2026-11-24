import { runCase, focusAndType, openRailOnRefine } from "../harness.mjs";

await runCase("copy", async (page, check) => {
  await focusAndType(page);
  const refineLeaf = await openRailOnRefine(page);
  await refineLeaf.click();
  await page.waitForSelector("aria/Replace text", { timeout: 5000 });

  const copyBtn = await page.waitForSelector("aria/Copy", { timeout: 3000 });
  await copyBtn.click();
  const copiedBtn = await page.waitForSelector("aria/Copied", { timeout: 2000 }).catch(() => null);
  check("Copy flips label to Copied", copiedBtn !== null);
});
