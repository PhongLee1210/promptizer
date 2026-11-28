import { browser } from "wxt/browser";

const FIRST_SAVE_NOTICE_KEY = "promptizer.firstSaveNoticeShown";

export async function hasShownFirstSaveNotice(): Promise<boolean> {
  const stored = await browser.storage.local.get(FIRST_SAVE_NOTICE_KEY);
  return stored[FIRST_SAVE_NOTICE_KEY] === true;
}

export async function markFirstSaveNoticeShown(): Promise<void> {
  await browser.storage.local.set({ [FIRST_SAVE_NOTICE_KEY]: true });
}

export async function clearFirstSaveNotice(): Promise<void> {
  await browser.storage.local.remove(FIRST_SAVE_NOTICE_KEY);
}
