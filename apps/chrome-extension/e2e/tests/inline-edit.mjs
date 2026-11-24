import { runCase, focusAndType, openRailOnRefine, findAccessibleName } from "../harness.mjs";

await runCase("inline-edit", async (page, check) => {
  await focusAndType(page);
  const refineLeaf = await openRailOnRefine(page);
  await refineLeaf.click();
  await page.waitForSelector("aria/Replace text", { timeout: 5000 });

  const snapshot = await page.accessibility.snapshot({ interestingOnly: false });
  const resultText = findAccessibleName(snapshot, (name) => name.startsWith("Refined: "));
  const resultBody = await page.waitForSelector(`aria/${resultText}[role="button"]`, { timeout: 3000 });
  await resultBody.click();

  const textarea = await page.waitForSelector("aria/Edit result", { timeout: 3000 });
  check("clicking result body opens inline edit textarea", textarea !== null);

  await textarea.evaluate((el, text) => {
    el.value = text;
  }, "manually edited result text");
  const saveBtn = await page.waitForSelector("aria/Save edit", { timeout: 3000 });
  await saveBtn.click();

  await new Promise((r) => setTimeout(r, 100));
  const after = await page.accessibility.snapshot({ interestingOnly: false });
  const edited = findAccessibleName(after, (name) => name === "manually edited result text");
  check("Save edit updates the shown result", edited !== null);
});
