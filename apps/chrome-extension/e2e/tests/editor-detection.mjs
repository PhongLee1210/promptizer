import { runCase, focusAndType, ORIGINAL_PROMPT } from "../harness.mjs";

const SECOND_EDITOR_TEXT = "second editor needs a fix";

async function fixGrammarAndReplace(page) {
  await (await page.waitForSelector("aria/Promptizer actions", { timeout: 5000 })).click();
  await new Promise((r) => setTimeout(r, 200));
  await (await page.waitForSelector("aria/Fix grammar", { timeout: 5000 })).click();
  await (await page.waitForSelector("aria/Replace text", { timeout: 5000 })).click();
  await new Promise((r) => setTimeout(r, 200));
}

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

  await fixGrammarAndReplace(page);
  const composerAfterFirstFix = await page.$eval("#composer", (composer) => composer.innerText.trim());

  await page.evaluate(() => {
    const textarea = document.createElement("textarea");
    textarea.id = "second-editor";
    document.body.append(textarea);
  });
  await page.click("#second-editor");
  await page.type("#second-editor", SECOND_EDITOR_TEXT);
  await fixGrammarAndReplace(page);
  check(
    "after a result in one editor, the chip follows focus to another editor and acts on it",
    (await page.$eval("#second-editor", (textarea) => textarea.value)) ===
      `${SECOND_EDITOR_TEXT.charAt(0).toUpperCase()}${SECOND_EDITOR_TEXT.slice(1)}.`,
  );
  check(
    "the first editor is left untouched by the second editor's action",
    (await page.$eval("#composer", (composer) => composer.innerText.trim())) === composerAfterFirstFix &&
      composerAfterFirstFix !== ORIGINAL_PROMPT,
  );
});
