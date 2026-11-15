import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeEditorText } from "../write-editor";

describe("writeEditorText", () => {
  describe("textarea and input", () => {
    it("sets the value through the native setter and fires input", () => {
      const textarea = document.createElement("textarea");
      textarea.value = "old draft";
      document.body.append(textarea);
      const listener = vi.fn();
      textarea.addEventListener("input", listener);

      writeEditorText(textarea, "new draft");

      expect(textarea.value).toBe("new draft");
      expect(textarea.selectionStart).toBe("new draft".length);
      expect(listener).toHaveBeenCalledTimes(1);
      textarea.remove();
    });

    it("works the same for a text input", () => {
      const input = document.createElement("input");
      input.type = "text";
      input.value = "old";
      document.body.append(input);

      writeEditorText(input, "new");

      expect(input.value).toBe("new");
      input.remove();
    });
  });

  describe("contenteditable", () => {
    let editor: HTMLDivElement;

    beforeEach(() => {
      editor = document.createElement("div");
      editor.contentEditable = "true";
      editor.textContent = "old draft";
      document.body.append(editor);
    });

    afterEach(() => {
      editor.remove();
      delete (document as unknown as { execCommand?: unknown }).execCommand;
    });

    it("prefers execCommand('insertText') when the browser honours it", () => {
      document.execCommand = vi.fn((command: string, _show: boolean, value?: string) => {
        if (command === "insertText") {
          editor.textContent = value ?? "";
          return true;
        }
        return false;
      });
      const listener = vi.fn();
      editor.addEventListener("input", listener);

      writeEditorText(editor, "new draft");

      expect(editor.textContent).toBe("new draft");
      expect(document.execCommand).toHaveBeenCalledWith("insertText", false, "new draft");
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("defers to the framework when it intercepts beforeinput, without also mutating the DOM itself", () => {
      document.execCommand = vi.fn().mockReturnValue(false);
      editor.addEventListener("beforeinput", (event) => {
        event.preventDefault();
        editor.textContent = (event as InputEvent).data ?? "";
      });

      writeEditorText(editor, "framework wrote this");

      expect(editor.textContent).toBe("framework wrote this");
    });

    it("falls back to a direct DOM write when neither execCommand nor beforeinput is handled", () => {
      document.execCommand = vi.fn().mockReturnValue(false);

      writeEditorText(editor, "fallback draft");

      expect(editor.textContent).toBe("fallback draft");
    });

    it("always fires a trailing input event so passive listeners see the change", () => {
      document.execCommand = vi.fn().mockReturnValue(false);
      const listener = vi.fn();
      editor.addEventListener("input", listener);

      writeEditorText(editor, "fallback draft");

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});
