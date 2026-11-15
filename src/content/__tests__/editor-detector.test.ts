import { describe, expect, it } from "vitest";
import { getEditorText, isContentEditableElement, resolveEditableTarget } from "../editor-detector";

describe("resolveEditableTarget", () => {
  it("accepts an enabled textarea", () => {
    const el = document.createElement("textarea");
    expect(resolveEditableTarget(el)).toBe(el);
  });

  it("rejects a disabled textarea", () => {
    const el = document.createElement("textarea");
    el.disabled = true;
    expect(resolveEditableTarget(el)).toBeNull();
  });

  it("rejects a readonly textarea", () => {
    const el = document.createElement("textarea");
    el.readOnly = true;
    expect(resolveEditableTarget(el)).toBeNull();
  });

  it("accepts a plain text input", () => {
    const el = document.createElement("input");
    el.type = "text";
    expect(resolveEditableTarget(el)).toBe(el);
  });

  it("accepts a search input", () => {
    const el = document.createElement("input");
    el.type = "search";
    expect(resolveEditableTarget(el)).toBe(el);
  });

  it("rejects a password input", () => {
    const el = document.createElement("input");
    el.type = "password";
    expect(resolveEditableTarget(el)).toBeNull();
  });

  it("rejects a checkbox input", () => {
    const el = document.createElement("input");
    el.type = "checkbox";
    expect(resolveEditableTarget(el)).toBeNull();
  });

  it("accepts a contenteditable div", () => {
    const el = document.createElement("div");
    el.contentEditable = "true";
    document.body.append(el);
    expect(resolveEditableTarget(el)).toBe(el);
    el.remove();
  });

  it("resolves to the outermost contenteditable ancestor when focus lands on a nested node", () => {
    const root = document.createElement("div");
    root.contentEditable = "true";
    const paragraph = document.createElement("p");
    const span = document.createElement("span");
    paragraph.append(span);
    root.append(paragraph);
    document.body.append(root);

    expect(resolveEditableTarget(span)).toBe(root);
    expect(resolveEditableTarget(paragraph)).toBe(root);
    root.remove();
  });

  it("rejects a non-editable div", () => {
    const el = document.createElement("div");
    expect(resolveEditableTarget(el)).toBeNull();
  });

  it("rejects null and non-element targets", () => {
    expect(resolveEditableTarget(null)).toBeNull();
    expect(resolveEditableTarget(window as unknown as EventTarget)).toBeNull();
  });
});

describe("getEditorText", () => {
  it("reads value from a textarea", () => {
    const el = document.createElement("textarea");
    el.value = "hello";
    expect(getEditorText(el)).toBe("hello");
  });

  it("reads value from a text input", () => {
    const el = document.createElement("input");
    el.value = "hi";
    expect(getEditorText(el)).toBe("hi");
  });

  it("reads innerText from a contenteditable element", () => {
    const el = document.createElement("div");
    el.contentEditable = "true";
    el.innerText = "draft text";
    expect(getEditorText(el)).toBe("draft text");
  });
});

describe("isContentEditableElement", () => {
  it("is false for textarea and input", () => {
    expect(isContentEditableElement(document.createElement("textarea"))).toBe(false);
    expect(isContentEditableElement(document.createElement("input"))).toBe(false);
  });

  it("is true for a contenteditable div", () => {
    expect(isContentEditableElement(document.createElement("div"))).toBe(true);
  });
});
