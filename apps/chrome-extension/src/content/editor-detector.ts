const PROSE_INPUT_TYPES = new Set(["text", ""]);

const NON_PROSE_INPUT_MODES = new Set(["none", "numeric", "decimal", "tel", "email", "url"]);

const NON_PROSE_AUTOCOMPLETE_TOKENS = new Set([
  "current-password",
  "new-password",
  "one-time-code",
  "username",
  "email",
  "tel",
  "tel-national",
  "tel-local",
  "cc-number",
  "cc-csc",
  "cc-exp",
  "cc-exp-month",
  "cc-exp-year",
  "cc-name",
  "postal-code",
  "country",
  "country-name",
  "url",
  "webauthn",
]);

const NON_PROSE_LABEL_PATTERN =
  /pass\s?(word|phrase)|passwd|pwd|\botp\b|one[\s-]?time|\b2fa\b|\bmfa\b|auth(entication)?[\s-]?code|verification[\s-]?code|security[\s-]?code|\bcvv\b|\bcvc\b|\bpin\b|credit[\s-]?card|card[\s-]?number|\biban\b|\bssn\b|secret|api[\s-]?key|access[\s-]?token|license[\s-]?key|serial|captcha|recovery[\s-]?code|\busername\b|\be-?mail\b|\bphone\b|zip[\s-]?code|postal/i;

const NON_PROSE_ROLES = new Set(["combobox", "searchbox", "spinbutton"]);

const MIN_PROSE_MAXLENGTH = 80;

function labelSignals(el: HTMLElement): string {
  const attributes = ["name", "id", "placeholder", "aria-label", "title", "autocomplete"];
  const own = attributes.map((attribute) => el.getAttribute(attribute) ?? "").join(" ");
  const labelledBy = el.getAttribute("aria-labelledby");
  const labelled =
    labelledBy === null
      ? ""
      : labelledBy
          .split(/\s+/)
          .map((id) => el.ownerDocument.getElementById(id)?.textContent ?? "")
          .join(" ");
  const wrappingLabel = el.closest("label")?.textContent ?? "";
  return `${own} ${labelled} ${wrappingLabel}`;
}

function hasNonProseAutocomplete(el: HTMLElement): boolean {
  const autocomplete = el.getAttribute("autocomplete");
  if (autocomplete === null) {
    return false;
  }
  return autocomplete
    .toLowerCase()
    .split(/\s+/)
    .some((token) => NON_PROSE_AUTOCOMPLETE_TOKENS.has(token));
}

function isTooShortForProse(el: HTMLElement): boolean {
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) {
    return false;
  }
  return el.maxLength >= 0 && el.maxLength < MIN_PROSE_MAXLENGTH;
}

function carriesNonProseSignal(el: HTMLElement): boolean {
  const role = el.getAttribute("role");
  if (role !== null && NON_PROSE_ROLES.has(role.toLowerCase())) {
    return true;
  }
  const inputMode = el.getAttribute("inputmode");
  if (inputMode !== null && NON_PROSE_INPUT_MODES.has(inputMode.toLowerCase())) {
    return true;
  }
  if (hasNonProseAutocomplete(el)) {
    return true;
  }
  if (isTooShortForProse(el)) {
    return true;
  }
  return NON_PROSE_LABEL_PATTERN.test(labelSignals(el));
}

function isEditableTag(el: HTMLElement): boolean {
  if (el instanceof HTMLTextAreaElement) {
    return !el.disabled && !el.readOnly;
  }
  if (el instanceof HTMLInputElement) {
    return PROSE_INPUT_TYPES.has(el.type) && !el.disabled && !el.readOnly;
  }
  return false;
}

function outermostContentEditableAncestor(el: HTMLElement): HTMLElement | null {
  let resolved: HTMLElement | null = el.isContentEditable ? el : null;
  let cursor: HTMLElement | null = el.parentElement;
  while (cursor !== null && cursor.isContentEditable) {
    resolved = cursor;
    cursor = cursor.parentElement;
  }
  return resolved;
}

export function resolveEditableTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof HTMLElement)) {
    return null;
  }
  const editor = isEditableTag(target) ? target : outermostContentEditableAncestor(target);
  if (editor === null || carriesNonProseSignal(editor)) {
    return null;
  }
  return editor;
}

export function getEditorText(editor: HTMLElement): string {
  if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) {
    return editor.value;
  }
  return editor.innerText;
}

export function isContentEditableElement(editor: HTMLElement): boolean {
  return !(editor instanceof HTMLTextAreaElement) && !(editor instanceof HTMLInputElement);
}
