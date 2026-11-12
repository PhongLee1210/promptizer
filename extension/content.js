(function (global) {
  "use strict";

  const core = global.PromptizerCore;
  const nano = global.PromptizerNano;
  const providerRouter = global.PromptizerProviderRouter;
  if (!core || !nano || !providerRouter || !global.chrome || !chrome.runtime) return;

  const state = {
    adapter: null,
    composer: null,
    root: null,
    shadow: null,
    requestId: "",
    requestFingerprint: "",
    inFlight: false,
    composing: false,
    selfChange: false,
    liveTimer: 0,
    lastLiveCall: 0,
    lastLiveText: "",
    selectedContext: "",
    previewLive: false,
    nanoController: null
  };

  function activeAdapter() {
    return (global.PromptizerAdapters || []).find((adapter) => adapter.matches()) || null;
  }

  function readEditor(element) {
    if (!element) return "";
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) return element.value;
    return element.innerText || element.textContent || "";
  }

  function writeEditor(element, value) {
    if (!element) return false;
    const originalValue = readEditor(element);
    const originalHTML = !(element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) ? element.innerHTML : "";
    state.selfChange = true;
    try {
      element.focus();
      if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
        const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(prototype, "value").set;
        setter.call(element, value);
        element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
      } else {
        const selection = global.getSelection();
        const range = document.createRange();
        range.selectNodeContents(element);
        selection.removeAllRanges();
        selection.addRange(range);
        const inserted = document.execCommand && document.execCommand("insertText", false, value);
        if (!inserted) {
          element.textContent = value;
          element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
        }
      }
      element.dispatchEvent(new Event("change", { bubbles: true }));
      const verified = core.normalizeText(readEditor(element)) === core.normalizeText(value);
      if (!verified) {
        if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
          const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          Object.getOwnPropertyDescriptor(prototype, "value").set.call(element, originalValue);
        } else {
          element.innerHTML = originalHTML;
        }
        element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText", data: originalValue }));
      }
      return verified;
    } finally {
      setTimeout(() => { state.selfChange = false; }, 0);
    }
  }

  function ensureRoot() {
    if (state.root && state.root.isConnected) return;
    state.root = document.createElement("div");
    state.root.id = "promptizer-extension-root";
    state.shadow = state.root.attachShadow({ mode: "closed" });
    state.shadow.innerHTML = `<style>${styles()}</style><button class="launcher" type="button" aria-label="Refine current prompt">Refine draft</button><section class="panel" hidden aria-live="polite"></section>`;
    document.documentElement.appendChild(state.root);
    state.shadow.querySelector(".launcher").addEventListener("click", () => trigger(false));
  }

  function styles() {
    return `
      :host { color-scheme: light dark; }
      * { box-sizing: border-box; }
      button, textarea, input, select { font: inherit; }
      .launcher { min-height:44px; padding:10px 16px; border:1px solid #0f766e; border-radius:999px; background:#0f766e; color:#fff; font:600 14px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; box-shadow:0 8px 24px rgba(15,23,42,.22); cursor:pointer; }
      .launcher:hover { background:#115e59; }
      .panel { width:min(420px,calc(100vw - 32px)); max-height:min(640px,calc(100vh - 32px)); overflow:auto; margin-top:10px; padding:16px; border:1px solid #99f6e4; border-radius:16px; background:#fff; color:#134e4a; box-shadow:0 18px 50px rgba(15,23,42,.28); font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
      .panel[hidden] { display:none; }
      .title { margin:0 0 4px; font-size:17px; line-height:1.3; color:#0f172a; }
      .eyebrow { margin:0 0 4px; color:#0f766e; font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }
      .help, .status { margin:0 0 12px; color:#475569; }
      .status.error { color:#b91c1c; }
      .suggestion-copy { max-height:180px; overflow:auto; padding:12px; border:1px solid #99f6e4; border-radius:10px; background:#f0fdfa; color:#134e4a; white-space:pre-wrap; overflow-wrap:anywhere; }
      .shortcut { margin-bottom:10px; }
      kbd { padding:2px 6px; border:1px solid #94a3b8; border-bottom-width:2px; border-radius:5px; background:#f8fafc; color:#0f172a; font:600 12px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace; }
      label { display:block; margin:12px 0 6px; font-weight:600; color:#0f172a; }
      textarea { width:100%; min-height:88px; resize:vertical; padding:10px 12px; border:1px solid #94a3b8; border-radius:10px; background:#fff; color:#0f172a; line-height:1.45; }
      textarea[readonly] { background:#f8fafc; color:#475569; }
      .check { display:flex; gap:8px; align-items:flex-start; font-weight:400; }
      .check input { margin-top:4px; }
      .actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:14px; }
      button { min-height:44px; padding:9px 14px; border:1px solid #64748b; border-radius:10px; background:#fff; color:#0f172a; cursor:pointer; transition:background-color .18s ease,border-color .18s ease; }
      button.primary { border-color:#0f766e; background:#0f766e; color:#fff; font-weight:600; }
      button:hover { background:#f1f5f9; }
      button.primary:hover { background:#115e59; }
      button:disabled { opacity:.55; cursor:not-allowed; }
      button:focus-visible, textarea:focus-visible, input:focus-visible { outline:3px solid #f97316; outline-offset:2px; }
      @media (prefers-color-scheme:dark) { .panel { background:#0f172a; color:#ccfbf1; border-color:#115e59; } .title,label { color:#f8fafc; } .eyebrow { color:#5eead4; } .help,.status { color:#cbd5e1; } .suggestion-copy { background:#111827; color:#ccfbf1; border-color:#115e59; } kbd,textarea,button { background:#1e293b; color:#f8fafc; border-color:#64748b; } textarea[readonly] { background:#111827; color:#cbd5e1; } button:hover { background:#334155; } }
      @media (prefers-reduced-motion:reduce) { * { transition:none !important; } }
    `;
  }

  function showPanel(html, focusSelector, role = "dialog") {
    ensureRoot();
    const panel = state.shadow.querySelector(".panel");
    panel.hidden = false;
    panel.setAttribute("role", role);
    if (role === "dialog") panel.setAttribute("aria-modal", "false");
    else panel.removeAttribute("aria-modal");
    panel.removeAttribute("aria-label");
    panel.innerHTML = html;
    panel.querySelectorAll("[data-dismiss]").forEach((button) => button.addEventListener("click", closePanel));
    const focusTarget = focusSelector && panel.querySelector(focusSelector);
    if (focusTarget) focusTarget.focus();
    return panel;
  }

  function closePanel() {
    if (!state.shadow) return;
    const panel = state.shadow.querySelector(".panel");
    panel.hidden = true;
    panel.innerHTML = "";
    state.previewLive = false;
    if (state.composer) state.composer.focus();
  }

  function showError(message, retry) {
    const panel = showPanel(`<h2 class="title">Promptizer</h2><p class="status error"></p><div class="actions">${retry ? '<button class="primary" data-retry type="button">Retry</button>' : ""}<button data-dismiss type="button">Dismiss</button></div>`, retry ? "[data-retry]" : "[data-dismiss]");
    panel.querySelector(".status").textContent = message;
    const retryButton = panel.querySelector("[data-retry]");
    if (retryButton) retryButton.addEventListener("click", () => trigger(false));
  }

  async function trigger(live) {
    state.adapter = activeAdapter();
    state.composer = state.adapter && state.adapter.findComposer();
    if (!state.composer) {
      showError("No supported prompt editor is active on this page.", false);
      return;
    }
    const original = core.normalizeText(readEditor(state.composer));
    if (!core.explicitEligible(original)) {
      if (!live) showError("Enter at least 8 characters before refining.", false);
      return;
    }
    const settings = await chrome.storage.local.get({ enabled: true, mode: "manual", taskSummary: "", providerMode: "nano-first", allowGroqFallback: true });
    if (!settings.enabled || (live && settings.mode !== "live")) return;
    if (live && (!core.liveEligible(original) || document.hidden || document.activeElement !== state.composer || state.composing)) return;

    let selected = "";
    if (!live && state.adapter.selectedTurns) selected = core.trimUTF8(state.adapter.selectedTurns(), 1800);
    if (selected) {
      const destination = settings.providerMode === "groq-only" ? "Groq" : "Gemini Nano on-device (or Groq only if fallback is enabled and needed)";
      const panel = showPanel(`<h2 class="title">Use selected context?</h2><p class="help" data-context-help></p><label class="check"><input type="checkbox" data-context checked><span>Include up to two selected visible turns</span></label><div class="actions"><button class="primary" data-continue type="button">Continue</button><button data-dismiss type="button">Cancel</button></div>`, "[data-continue]");
      panel.querySelector("[data-context-help]").textContent = `Only the selected visible text and current draft will be processed by ${destination}.`;
      panel.querySelector("[data-continue]").addEventListener("click", () => performRequest(original, settings, panel.querySelector("[data-context]").checked ? selected : "", false));
      return;
    }
    await performRequest(original, settings, "", live);
  }

  async function performRequest(original, settings, selectedContext, live) {
    if (state.inFlight) {
      if (!live) showError("A refinement is already running.", false);
      return;
    }
    state.inFlight = true;
    state.requestId = crypto.randomUUID();
    state.requestFingerprint = core.fingerprint(original);
    state.lastLiveCall = Date.now();
    state.lastLiveText = original;
    if (!live) showPanel(`<h2 class="title">Refining draft</h2><p class="status">Your original text remains unchanged.</p><div class="actions"><button data-cancel type="button">Cancel</button></div>`, "[data-cancel]");
    const cancelButton = state.shadow && state.shadow.querySelector("[data-cancel]");
    if (cancelButton) cancelButton.addEventListener("click", cancelRequest);

    const payload = {
      request_id: state.requestId,
      prompt: original,
      task_context: core.buildContext(settings.taskSummary, selectedContext),
      constraints: [],
      mode: "rewrite",
      source: "browser",
      trigger: live ? "live" : "manual"
    };
    const requestId = state.requestId;
    state.nanoController = new AbortController();
    const response = await providerRouter.refine(payload, settings, {
      nano,
      signal: state.nanoController.signal,
      groq: () => chrome.runtime.sendMessage({ type: "PROMPTIZER_REFINE", payload }).catch(() => ({ ok: false, error: { message: "Promptizer extension messaging failed." } }))
    });
    state.nanoController = null;
    state.inFlight = false;
    if (requestId !== state.requestId) return;
    const current = core.normalizeText(readEditor(state.composer));
    if (core.fingerprint(current) !== state.requestFingerprint) {
      if (!live) showError("The draft changed while refining, so the old result was discarded.", true);
      return;
    }
    if (!response || !response.ok) {
      if (!live) showError(response && response.error ? response.error.message : "Refinement failed. Your draft was not changed.", true);
      return;
    }
    if (!core.validResponse(response.data, requestId)) {
      if (!live) showError("The service returned an invalid or stale result. Your draft was not changed.", true);
      return;
    }
    showPreview(original, response.data.refined_prompt, live, response.data.provider || "groq");
  }

  function showPreview(original, refined, live, provider) {
    state.previewLive = Boolean(live);
    const providerLabel = provider === "gemini-nano" ? "Gemini Nano · on-device" : "Groq · cloud fallback";
    const panel = live
      ? showPanel(`<p class="eyebrow">Live suggestion</p><h2 class="title">A clearer prompt is ready</h2><p class="help" data-provider></p><p class="help shortcut">Press <kbd>Tab</kbd> to replace, or <kbd>Esc</kbd> to dismiss.</p><div class="suggestion-copy" data-suggestion aria-label="Suggested prompt"></div><p class="status" aria-live="polite"></p><div class="actions"><button class="primary" data-replace type="button">Accept suggestion</button><button data-copy type="button">Copy</button><button data-dismiss type="button">Dismiss</button></div>`, null, "region")
      : showPanel(`<h2 class="title">Review refinement</h2><p class="help">Nothing changes until you choose Replace.</p><p class="help" data-provider></p><label for="promptizer-original">Original</label><textarea id="promptizer-original" readonly></textarea><label for="promptizer-refined">Refined prompt</label><textarea id="promptizer-refined"></textarea><p class="status" aria-live="polite"></p><div class="actions"><button class="primary" data-replace type="button">Replace</button><button data-copy type="button">Copy</button><button data-dismiss type="button">Dismiss</button></div>`, "#promptizer-refined");
    panel.querySelector("[data-provider]").textContent = providerLabel;
    if (live) {
      panel.setAttribute("aria-label", "Promptizer suggestion");
      panel.querySelector("[data-suggestion]").textContent = refined;
    } else {
      panel.removeAttribute("aria-label");
      panel.querySelector("#promptizer-original").value = original;
      panel.querySelector("#promptizer-refined").value = refined;
    }
    panel.querySelector("[data-replace]").addEventListener("click", async () => {
      const value = core.normalizeText(live ? refined : panel.querySelector("#promptizer-refined").value);
      if (!value) {
        panel.querySelector(".status").textContent = "The refined prompt cannot be empty.";
        return;
      }
      if (core.fingerprint(readEditor(state.composer)) !== state.requestFingerprint) {
        showError("The draft changed, so Promptizer did not replace it.", true);
        return;
      }
      const replaced = writeEditor(state.composer, value);
      if (!replaced) {
        panel.querySelector(".status").textContent = "The editor rejected insertion. Use Copy instead; your original draft is unchanged.";
        return;
      }
      closePanel();
    });
    panel.querySelector("[data-copy]").addEventListener("click", async () => {
      try {
        const value = core.normalizeText(live ? refined : panel.querySelector("#promptizer-refined").value);
        await navigator.clipboard.writeText(value);
        panel.querySelector(".status").textContent = "Copied. The original draft is unchanged.";
      } catch (_) {
        panel.querySelector(".status").textContent = "Copy failed; select the refined text manually.";
      }
    });
  }

  function composerHasFocus() {
    const active = document.activeElement;
    return Boolean(state.composer && (active === state.composer || state.composer.contains(active)));
  }

  function caretAtEnd(element) {
    if (!element) return false;
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
      return element.selectionStart === element.value.length && element.selectionEnd === element.value.length;
    }
    const selection = global.getSelection();
    if (!selection || selection.rangeCount !== 1 || !selection.isCollapsed) return false;
    const range = selection.getRangeAt(0);
    if (range.endContainer !== element && !element.contains(range.endContainer)) return false;
    const tail = document.createRange();
    tail.selectNodeContents(element);
    try {
      tail.setStart(range.endContainer, range.endOffset);
    } catch (_) {
      return false;
    }
    return core.normalizeText(tail.toString()) === "";
  }

  function onKeydown(event) {
    if (!state.shadow) return;
    const panel = state.shadow.querySelector(".panel");
    if (!panel || panel.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      cancelRequest();
      return;
    }
    if (event.key !== "Tab") return;
    const accept = core.canAcceptSuggestion({
      key: event.key,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      composing: state.composing,
      suggestionActive: state.previewLive,
      composerFocused: composerHasFocus(),
      caretAtEnd: caretAtEnd(state.composer)
    });
    if (!accept) return;
    const replaceButton = panel.querySelector("[data-replace]");
    if (!replaceButton) return;
    event.preventDefault();
    replaceButton.click();
  }

  function cancelRequest() {
    if (!state.inFlight || !state.requestId) return closePanel();
    if (state.nanoController) state.nanoController.abort();
    chrome.runtime.sendMessage({ type: "PROMPTIZER_CANCEL", requestId: state.requestId }).catch(() => {});
    state.requestId = "";
    state.inFlight = false;
    closePanel();
  }

  function onInput(event) {
    if (state.selfChange) return;
    state.adapter = activeAdapter();
    const composer = state.adapter && state.adapter.findComposer();
    if (!composer || !composer.contains(event.target) && composer !== event.target) return;
    state.composer = composer;
    if (state.previewLive) closePanel();
    if (state.inFlight && core.fingerprint(readEditor(composer)) !== state.requestFingerprint) cancelRequest();
    clearTimeout(state.liveTimer);
    state.liveTimer = setTimeout(async () => {
      const settings = await chrome.storage.local.get({ enabled: true, mode: "manual" });
      const text = core.normalizeText(readEditor(composer));
      const remaining = core.liveDelay(state.lastLiveCall, Date.now());
      if (remaining > 0) {
        state.liveTimer = setTimeout(() => trigger(true), remaining);
      } else if (settings.enabled && settings.mode === "live" && core.meaningfulChange(state.lastLiveText, text)) {
        trigger(true);
      }
    }, 650);
  }

  function refresh() {
    state.adapter = activeAdapter();
    state.composer = state.adapter && state.adapter.findComposer();
    ensureRoot();
    state.shadow.querySelector(".launcher").hidden = !state.composer;
  }

  document.addEventListener("input", onInput, true);
  document.addEventListener("compositionstart", () => { state.composing = true; }, true);
  document.addEventListener("compositionend", () => { state.composing = false; }, true);
  document.addEventListener("keydown", onKeydown, true);
  document.addEventListener("visibilitychange", () => { if (document.hidden && state.inFlight) cancelRequest(); });
  chrome.runtime.onMessage.addListener((message) => { if (message && message.type === "PROMPTIZER_TRIGGER") trigger(false); });
  new MutationObserver(refresh).observe(document.documentElement, { childList: true, subtree: true });
  refresh();
})(globalThis);

