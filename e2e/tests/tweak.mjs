import { runCase, focusAndType, openRailOnRefine } from "../harness.mjs";

await runCase("tweak", async (page, check) => {
  await focusAndType(page);
  const refineLeaf = await openRailOnRefine(page);
  await refineLeaf.click();
  await page.waitForSelector("aria/Replace text", { timeout: 5000 });

  const tweakBtn = await page.waitForSelector("aria/Tweak", { timeout: 3000 });
  await tweakBtn.click();
  const shortenLeaf = await page.waitForSelector("aria/Shorten", { timeout: 3000 });
  check("Tweak menu exposes leaves (e.g. Shorten)", shortenLeaf !== null);

  await shortenLeaf.click();
  const replaceAfterTweak = await page.waitForSelector("aria/Replace text", { timeout: 5000 });
  check("Tweak run re-applies to result and returns to result view", replaceAfterTweak !== null);
});
