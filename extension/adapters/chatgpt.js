(function (global) {
  "use strict";
  global.PromptizerAdapters = global.PromptizerAdapters || [];

  function findComposer() {
    const candidates = [
      document.querySelector("#prompt-textarea[contenteditable='true']"),
      document.querySelector("textarea[data-testid='prompt-textarea']"),
      document.querySelector("[contenteditable='true'][data-testid*='composer']"),
      document.querySelector("div.ProseMirror[contenteditable='true'][role='textbox']"),
    ];
    return candidates.find((element) => element && element.getClientRects().length > 0) || null;
  }

  function selectedTurns() {
    const selection = global.getSelection && global.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) return "";
    const range = selection.rangeCount ? selection.getRangeAt(0) : null;
    const turns = Array.from(
      document.querySelectorAll(
        "[data-message-author-role], [data-testid^='conversation-turn'], article[data-testid*='conversation-turn']",
      ),
    )
      .filter((element) => {
        try {
          return range && range.intersectsNode(element) && element.getClientRects().length > 0;
        } catch (_) {
          return false;
        }
      })
      .slice(-2)
      .map((element) => element.innerText.trim())
      .filter(Boolean);
    return turns.length ? turns.join("\n") : selection.toString().trim();
  }

  global.PromptizerAdapters.push({
    id: "chatgpt",
    matches: () => global.location.hostname === "chatgpt.com",
    findComposer,
    selectedTurns,
  });
})(globalThis);
