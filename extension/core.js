(function (global) {
  "use strict";

  const encoder = new TextEncoder();
  const decoder = new TextDecoder("utf-8", { fatal: false });

  function normalizeText(value) {
    return String(value || "")
      .replace(/\r\n?/g, "\n")
      .trim();
  }

  function unicodeLength(value) {
    return Array.from(normalizeText(value)).length;
  }

  function fingerprint(value) {
    const text = normalizeText(value);
    let hash = 2166136261;
    for (const character of text) {
      hash ^= character.codePointAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return `${text.length}:${(hash >>> 0).toString(16)}`;
  }

  function trimUTF8(value, maximumBytes) {
    const bytes = encoder.encode(normalizeText(value));
    if (bytes.length <= maximumBytes) return decoder.decode(bytes);
    let end = maximumBytes;
    while (end > 0 && (bytes[end] & 0xc0) === 0x80) end -= 1;
    return decoder.decode(bytes.slice(0, end)).trim();
  }

  function explicitEligible(value) {
    return unicodeLength(value) >= 8 && encoder.encode(normalizeText(value)).length <= 4000;
  }

  function liveEligible(value) {
    const normalized = normalizeText(value);
    return (
      unicodeLength(normalized) >= 20 &&
      normalized.split(/\s+/u).filter(Boolean).length >= 3 &&
      encoder.encode(normalized).length <= 4000
    );
  }

  function meaningfulChange(previous, current) {
    const before = normalizeText(previous);
    const after = normalizeText(current);
    if (before === after) return false;
    return (
      Math.abs(Array.from(after).length - Array.from(before).length) >= 5 ||
      before.split(/\s+/u).length !== after.split(/\s+/u).length
    );
  }

  function liveDelay(lastCall, now) {
    return Math.max(0, 4000 - (now - lastCall));
  }

  function canAcceptSuggestion(options) {
    const value = options || {};
    return (
      value.key === "Tab" &&
      !value.altKey &&
      !value.ctrlKey &&
      !value.metaKey &&
      !value.shiftKey &&
      !value.composing &&
      value.suggestionActive === true &&
      value.composerFocused === true &&
      value.caretAtEnd === true
    );
  }

  function buildContext(summary, selectedTurns) {
    const parts = [];
    const safeSummary = normalizeText(summary);
    const safeSelection = normalizeText(selectedTurns);
    if (safeSummary) parts.push(`Task summary: ${safeSummary}`);
    if (safeSelection) parts.push(`Explicitly selected recent turns: ${safeSelection}`);
    return trimUTF8(parts.join("\n"), 2000);
  }

  function validResponse(value, requestId) {
    if (!value || value.request_id !== requestId) return false;
    if (value.decision !== "keep" && value.decision !== "refine") return false;
    const prompt = String(value.refined_prompt || "");
    if (!prompt || prompt !== prompt.trim() || /[\r\n]/u.test(prompt)) return false;
    if (/^(#|- |\* |• |1[.)] )/u.test(prompt)) return false;
    return encoder.encode(prompt).length <= 4000;
  }

  global.PromptizerCore = Object.freeze({
    normalizeText,
    unicodeLength,
    fingerprint,
    trimUTF8,
    explicitEligible,
    liveEligible,
    meaningfulChange,
    liveDelay,
    canAcceptSuggestion,
    buildContext,
    validResponse,
  });
})(globalThis);
