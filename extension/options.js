"use strict";

const defaults = {
  enabled: true,
  mode: "manual",
  taskSummary: "",
  pairingToken: "",
  providerMode: "nano-first",
  allowGroqFallback: true,
};
const fields = {
  enabled: document.querySelector("#enabled"),
  mode: document.querySelector("#mode"),
  taskSummary: document.querySelector("#task-summary"),
  pairingToken: document.querySelector("#pairing-token"),
  providerMode: document.querySelector("#provider-mode"),
  groqFallback: document.querySelector("#groq-fallback"),
  origin: document.querySelector("#extension-origin"),
  status: document.querySelector("#status"),
  nanoStatus: document.querySelector("#nano-status"),
  setupNano: document.querySelector("#setup-nano"),
};

async function load() {
  const settings = await chrome.storage.local.get(defaults);
  fields.enabled.checked = settings.enabled;
  fields.mode.value = settings.mode;
  fields.taskSummary.value = settings.taskSummary;
  fields.pairingToken.value = settings.pairingToken;
  fields.providerMode.value = settings.providerMode === "groq-only" ? "groq-only" : "nano-first";
  fields.groqFallback.checked = settings.allowGroqFallback !== false;
  fields.origin.value = chrome.runtime.getURL("").replace(/\/$/, "");
}

document.querySelector("#save").addEventListener("click", async () => {
  await chrome.storage.local.set({
    enabled: fields.enabled.checked,
    mode: fields.mode.value === "live" ? "live" : "manual",
    taskSummary: fields.taskSummary.value.trim(),
    pairingToken: fields.pairingToken.value.trim(),
    providerMode: fields.providerMode.value === "groq-only" ? "groq-only" : "nano-first",
    allowGroqFallback: fields.groqFallback.checked,
  });
  fields.status.textContent = "Saved locally.";
  setTimeout(() => {
    fields.status.textContent = "";
  }, 2500);
});

fields.setupNano.addEventListener("click", async () => {
  fields.setupNano.disabled = true;
  fields.nanoStatus.textContent = "Checking Chrome…";
  const current = await PromptizerNano.availability();
  if (current === "available") {
    fields.nanoStatus.textContent = "Ready on this device.";
    fields.setupNano.disabled = false;
    return;
  }
  if (current === "unavailable") {
    fields.nanoStatus.textContent = "Unavailable; Groq fallback will be used.";
    fields.setupNano.disabled = false;
    return;
  }
  fields.nanoStatus.textContent = current === "downloading" ? "Finishing model download…" : "Downloading model…";
  const result = await PromptizerNano.download(undefined, (loaded, total) => {
    const percentage = total ? Math.floor((loaded / total) * 100) : Math.floor(loaded * 100);
    fields.nanoStatus.textContent = `Downloading model: ${Math.max(0, Math.min(100, percentage))}%`;
  });
  fields.nanoStatus.textContent = result.ok ? "Ready on this device." : `${result.error} Groq fallback will be used.`;
  fields.setupNano.disabled = false;
});

document.querySelector("#copy-origin").addEventListener("click", async () => {
  await navigator.clipboard.writeText(fields.origin.value);
  fields.status.textContent = "Extension origin copied.";
});

load();
