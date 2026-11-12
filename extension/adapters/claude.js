(function (global) {
  "use strict";
  global.PromptizerAdapters = global.PromptizerAdapters || [];

  function findComposer() {
    const candidates = [
      document.querySelector("[contenteditable='true'][data-testid*='chat-input']"),
      document.querySelector("div.ProseMirror[contenteditable='true']"),
      document.querySelector("fieldset [contenteditable='true'][role='textbox']")
    ];
    return candidates.find((element) => element && element.getClientRects().length > 0) || null;
  }

  function selectedTurns() {
    const selection = global.getSelection && global.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) return "";
    const range = selection.rangeCount ? selection.getRangeAt(0) : null;
    const turns = Array.from(document.querySelectorAll("[data-testid*='conversation-turn'], [data-testid*='user-message'], [data-testid*='assistant-message']"))
      .filter((element) => {
        try { return range && range.intersectsNode(element) && element.getClientRects().length > 0; } catch (_) { return false; }
      })
      .slice(-2)
      .map((element) => element.innerText.trim())
      .filter(Boolean);
    return turns.length ? turns.join("\n") : selection.toString().trim();
  }

  global.PromptizerAdapters.push({
    id: "claude",
    matches: () => global.location.hostname === "claude.ai",
    findComposer,
    selectedTurns
  });
})(globalThis);

