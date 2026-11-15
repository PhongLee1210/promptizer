const EDITABLE_INPUT_TYPES = new Set(["text", "search", "url", "email", "tel", ""]);

function isEditableTag(el: HTMLElement): boolean {
  if (el instanceof HTMLTextAreaElement) {
    return !el.disabled && !el.readOnly;
  }
  if (el instanceof HTMLInputElement) {
    return EDITABLE_INPUT_TYPES.has(el.type) && !el.disabled && !el.readOnly;
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
  if (isEditableTag(target)) {
    return target;
  }
  return outermostContentEditableAncestor(target);
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
