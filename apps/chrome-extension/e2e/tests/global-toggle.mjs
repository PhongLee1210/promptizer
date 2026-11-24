import { runCase, focusAndType, extensionId } from "../harness.mjs";

async function waitForChipAbsent(page, timeoutMs = 4000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const chip = await page.$("aria/Promptizer actions").catch(() => null);
    if (chip === null) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

async function waitForChipPresent(page, timeoutMs = 4000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const chip = await page.$("aria/Promptizer actions").catch(() => null);
    if (chip !== null) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

await runCase("global-toggle", async (page, check, browser) => {
  await focusAndType(page);
  const chipAppears = await waitForChipPresent(page, 5000);
  check("chip appears on composer focus before any toggle", chipAppears);

  const popupPage = await browser.newPage();
  await popupPage.goto(`chrome-extension://${extensionId()}/popup.html`, { waitUntil: "networkidle0" });

  const turnOffBtn = await popupPage.waitForSelector("aria/Turn suggestions off", { timeout: 5000 });
  await turnOffBtn.click();

  await page.bringToFront();
  await page.click("#composer");
  const chipGoneAfterOff = await waitForChipAbsent(page, 5000);
  check("toggling global switch OFF hides the chip without reload", chipGoneAfterOff);

  await popupPage.bringToFront();
  const turnOnBtn = await popupPage.waitForSelector("aria/Turn suggestions on", { timeout: 5000 });
  await turnOnBtn.click();

  await page.bringToFront();
  await page.click("#composer");
  const chipBackAfterOn = await waitForChipPresent(page, 5000);
  check("toggling global switch back ON brings the chip back without reload", chipBackAfterOn);

  await popupPage.close();
});
