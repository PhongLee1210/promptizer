"use strict";

const controllers = new Map();
const defaults = { enabled: true, mode: "manual", taskSummary: "", pairingToken: "", providerMode: "nano-first", allowGroqFallback: true };

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(defaults, (stored) => chrome.storage.local.set(stored));
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "refine-prompt") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id) chrome.tabs.sendMessage(tab.id, { type: "PROMPTIZER_TRIGGER" }).catch(() => {});
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !message.type) return false;
  if (message.type === "PROMPTIZER_CANCEL") {
    const controller = controllers.get(message.requestId);
    if (controller) controller.abort();
    sendResponse({ ok: true });
    return false;
  }
  if (message.type !== "PROMPTIZER_REFINE") return false;
  performGroqRefinement(message.payload).then(sendResponse);
  return true;
});

async function performGroqRefinement(payload) {
  const settings = await chrome.storage.local.get(defaults);
  if (!settings.enabled) return { ok: false, error: { code: "DISABLED", message: "Promptizer is disabled in settings." } };
  const controller = new AbortController();
  controllers.set(payload.request_id, controller);
  const timeout = setTimeout(() => controller.abort(), 6500);
  try {
    return await callGroq(payload, settings, controller.signal);
  } finally {
    clearTimeout(timeout);
    controllers.delete(payload.request_id);
  }
}

async function callGroq(payload, settings, signal) {
  if (!settings.pairingToken) return { ok: false, error: { code: "UNPAIRED", message: "Gemini Nano is unavailable and Groq fallback is not paired. Open Promptizer settings." } };
  try {
    const response = await fetch("http://127.0.0.1:8765/v1/refine", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${settings.pairingToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal,
      cache: "no-store"
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return { ok: false, error: data && data.error ? data.error : { code: "SERVICE_ERROR", message: "Refinement failed. Your draft was not changed." } };
    }
    data.provider = "groq";
    return { ok: true, data };
  } catch (error) {
    const timeoutMessage = error && error.name === "AbortError" ? "Refinement was canceled or timed out. Your draft was not changed." : "Local Promptizer service is unavailable. Your draft was not changed.";
    return { ok: false, error: { code: "SERVICE_UNAVAILABLE", message: timeoutMessage } };
  }
}

