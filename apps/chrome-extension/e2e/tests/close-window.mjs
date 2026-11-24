import { runCase, focusAndType, openRailOnRefine } from "../harness.mjs";

await runCase("close-window", async (page, check) => {
  await focusAndType(page);
  const refineLeaf = await openRailOnRefine(page);
  await refineLeaf.click();
  await page.waitForSelector("aria/Replace text", { timeout: 5000 });

  const closeBtn = await page.waitForSelector("aria/Close", { timeout: 3000 });
  await closeBtn.click();

  await new Promise((r) => setTimeout(r, 200));
  const replaceGone = await page.$("aria/Replace text").catch(() => null);
  check("Close dismisses the result window", replaceGone === null);
});
