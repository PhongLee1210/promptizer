import { runCase, focusAndType } from "../harness.mjs";

await runCase("editor-detection", async (page, check) => {
  await page.click("#not-an-editor");
  await new Promise((r) => setTimeout(r, 300));

  let chipOnButton = null;
  try {
    chipOnButton = await page.waitForSelector("aria/Promptizer actions", { timeout: 1500 });
  } catch {
    chipOnButton = null;
  }
  check("chip does not appear for a non-editable focusable element", chipOnButton === null);

  await focusAndType(page);
  const chipOnComposer = await page.waitForSelector("aria/Promptizer actions", { timeout: 5000 });
  check("chip appears once a recognized editable element is focused", chipOnComposer !== null);
});
