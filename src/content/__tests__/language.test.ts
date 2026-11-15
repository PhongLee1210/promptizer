import { afterEach, describe, expect, it, vi } from "vitest";
import { targetLanguageName } from "../language";

describe("targetLanguageName", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("names the browser's primary language when it is not English", () => {
    vi.stubGlobal("navigator", { ...navigator, languages: ["fr-FR", "en-US"], language: "fr-FR" });
    expect(targetLanguageName()).toBe("French");
  });

  it("falls back to the secondary language when the primary is English", () => {
    vi.stubGlobal("navigator", { ...navigator, languages: ["en-US", "es-ES"], language: "en-US" });
    expect(targetLanguageName()).toBe("Spanish");
  });

  it("falls back to English if nothing else is available", () => {
    vi.stubGlobal("navigator", { ...navigator, languages: ["en-US"], language: "en-US" });
    expect(targetLanguageName()).toBe("English");
  });
});
