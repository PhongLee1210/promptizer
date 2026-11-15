function nativeValueSetter(el: HTMLTextAreaElement | HTMLInputElement): ((value: string) => void) | undefined {
  const prototype = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  const setter = descriptor?.set;
  if (setter === undefined) {
    return undefined;
  }
  return (value: string) => setter.call(el, value);
}

function placeCaretAtEnd(el: HTMLElement): void {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function selectEntireContent(el: HTMLElement): void {
  const range = document.createRange();
  range.selectNodeContents(el);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function dispatchInputEvent(editor: HTMLElement): void {
  editor.dispatchEvent(
    new InputEvent("input", { bubbles: true, cancelable: false, inputType: "insertReplacementText" }),
  );
}

function tryExecCommandReplace(editor: HTMLElement, text: string): boolean {
  selectEntireContent(editor);
  let accepted: boolean;
  try {
    accepted = document.execCommand("insertText", false, text);
  } catch {
    accepted = false;
  }
  return accepted && editor.textContent === text;
}

function dispatchReplacementBeforeInput(editor: HTMLElement, text: string): boolean {
  selectEntireContent(editor);
  const beforeInput = new InputEvent("beforeinput", {
    inputType: "insertReplacementText",
    data: text,
    bubbles: true,
    cancelable: true,
  });
  const notIntercepted = editor.dispatchEvent(beforeInput);
  return !notIntercepted;
}

function writeContentEditable(editor: HTMLElement, text: string): void {
  if (tryExecCommandReplace(editor, text)) {
    dispatchInputEvent(editor);
    return;
  }
  const frameworkHandledIt = dispatchReplacementBeforeInput(editor, text);
  if (!frameworkHandledIt) {
    editor.textContent = text;
    placeCaretAtEnd(editor);
  }
  dispatchInputEvent(editor);
}

function writeTextareaOrInput(editor: HTMLTextAreaElement | HTMLInputElement, text: string): void {
  const setValue = nativeValueSetter(editor);
  if (setValue !== undefined) {
    setValue(text);
  } else {
    editor.value = text;
  }
  editor.setSelectionRange(text.length, text.length);
  dispatchInputEvent(editor);
}

export function writeEditorText(editor: HTMLElement, text: string): void {
  if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) {
    writeTextareaOrInput(editor, text);
  } else {
    writeContentEditable(editor, text);
  }
}
