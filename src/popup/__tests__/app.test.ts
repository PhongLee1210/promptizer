import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { mountPopup } from "../app";
import { evictWarmSessions, type NanoAvailability } from "../../content/nano";

interface DownloadMonitor {
  addEventListener(type: "downloadprogress", listener: (event: { loaded: number }) => void): void;
}

function stubLanguageModel(availability: NanoAvailability, progressFraction = 0.5): ReturnType<typeof vi.fn> {
  const create = vi.fn(async (options: { monitor?: (monitor: DownloadMonitor) => void }) => {
    options.monitor?.({
      addEventListener: (_type, listener) => listener({ loaded: progressFraction }),
    });
    return { prompt: vi.fn(), destroy: vi.fn() };
  });
  (globalThis as Record<string, unknown>).LanguageModel = {
    availability: vi.fn().mockResolvedValue(availability),
    create,
  };
  return create;
}

async function mount(): Promise<HTMLElement> {
  const root = document.createElement("div");
  document.body.append(root);
  await mountPopup(root);
  return root;
}

function navItemLabelled(root: HTMLElement, label: string): HTMLButtonElement {
  const items = [...root.querySelectorAll<HTMLButtonElement>(".pz-nav-item")];
  return items.find((item) => item.getAttribute("aria-label")?.startsWith(label))!;
}

describe("mountPopup", () => {
  beforeEach(() => {
    fakeBrowser.reset();
    localStorage.clear();
    evictWarmSessions();
    stubLanguageModel("available");
    vi.spyOn(fakeBrowser.runtime, "getManifest").mockReturnValue({
      version: "0.1.0",
    } as ReturnType<typeof fakeBrowser.runtime.getManifest>);
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).LanguageModel;
  });

  it("renders the main screen with the power button focused", async () => {
    const root = await mount();

    const power = root.querySelector<HTMLButtonElement>(".pz-power-button");
    expect(power?.getAttribute("aria-pressed")).toBe("true");
    expect(document.activeElement).toBe(power);
  });

  it("renders the brand mark as the packaged icon at the top of the nav rail", async () => {
    const root = await mount();

    const brand = root.querySelector<HTMLImageElement>(".pz-nav-rail .pz-brand-logo");
    expect(brand?.tagName).toBe("IMG");
    expect(brand?.getAttribute("src")).toContain("/icon/32.png");
    expect(navItemLabelled(root, "Promptizer home").getAttribute("aria-current")).toBe("page");
  });

  it("pauses suggestions and reports it from the power button", async () => {
    const root = await mount();

    root.querySelector<HTMLButtonElement>(".pz-power-button")!.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(root.querySelector(".pz-power-button")?.getAttribute("aria-pressed")).toBe("false");
    expect(root.textContent).toContain("Suggestions are paused");
  });

  it("has no settings rows on the main screen", async () => {
    const root = await mount();

    expect(root.textContent).not.toContain("Platforms");
    expect(root.textContent).not.toContain("Providers");
  });

  it("lists every section in the nav rail with an accessible name", async () => {
    const root = await mount();

    const labels = [...root.querySelectorAll(".pz-nav-item")].map((item) => item.getAttribute("aria-label"));
    expect(labels).toEqual([
      "Promptizer home",
      "Platforms",
      "Models & keys",
      "Providers & keys",
      "Suggestions",
      "Setup guide, Ready",
      "Help",
      "Privacy",
    ]);
  });

  it("navigates to the Platforms screen, marks it current and keeps focus on the rail", async () => {
    const root = await mount();

    navItemLabelled(root, "Platforms").focus();
    navItemLabelled(root, "Platforms").click();

    expect(root.querySelector(".pz-header-sub")?.textContent).toContain("Platforms");
    expect(root.querySelector<HTMLButtonElement>("#pz-platform-claude")).not.toBeNull();
    expect(navItemLabelled(root, "Platforms").getAttribute("aria-current")).toBe("page");
    expect(navItemLabelled(root, "Promptizer home").getAttribute("aria-current")).toBeNull();
    expect(document.activeElement).toBe(navItemLabelled(root, "Platforms"));
  });

  it("navigates to the Suggestions screen and keeps its switches", async () => {
    const root = await mount();

    navItemLabelled(root, "Suggestions").click();

    expect(root.querySelector("#pz-suggest-mode")?.getAttribute("aria-checked")).toBe("true");
    expect(root.querySelector("#pz-suggest-clarity")?.getAttribute("aria-checked")).toBe("true");
    expect(root.querySelector("#pz-suggest-cloud-live")?.getAttribute("aria-disabled")).toBe("true");
    expect(root.textContent).toContain("No cloud model connected");
  });

  it("stores a suggestion category change under the current schema", async () => {
    const root = await mount();

    navItemLabelled(root, "Suggestions").click();
    root.querySelector<HTMLButtonElement>("#pz-suggest-gap")!.click();
    await Promise.resolve();
    await Promise.resolve();

    const stored = await fakeBrowser.storage.local.get("popupState");
    expect(stored.popupState).toMatchObject({ schema: 3, suggest: { categories: { gap: false } } });
  });

  it("opens the model screen from the main model card", async () => {
    const root = await mount();

    root.querySelector<HTMLButtonElement>(".pz-region-card__main")!.click();

    expect(root.querySelector(".pz-header-sub")?.textContent).toContain("Models & keys");
  });

  it("toggles a platform from the Platforms screen", async () => {
    const root = await mount();

    navItemLabelled(root, "Platforms").click();

    const claudeToggle = root.querySelector<HTMLButtonElement>("#pz-platform-claude")!;
    expect(claudeToggle.getAttribute("aria-checked")).toBe("true");
    claudeToggle.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(root.querySelector<HTMLButtonElement>("#pz-platform-claude")?.getAttribute("aria-checked")).toBe("false");
  });

  it("surfaces the setup steps when Chrome reports no on-device model", async () => {
    stubLanguageModel("unavailable");
    const root = await mount();

    expect(root.textContent).toContain("On-device AI needs setup");
    root.querySelector<HTMLButtonElement>(".pz-card .pz-button--primary")!.click();

    expect(root.querySelector(".pz-header-sub")?.textContent).toContain("On-device AI");
    expect(root.querySelectorAll(".pz-step")).toHaveLength(6);
    expect(root.textContent).toContain("chrome://flags/#prompt-api");
    expect([...root.querySelectorAll<HTMLImageElement>(".pz-step__shot")].map((shot) => shot.alt)).toHaveLength(4);
  });

  it("downloads Gemini Nano from the setup screen and tracks progress", async () => {
    const create = stubLanguageModel("downloadable", 0.5);
    const root = await mount();

    navItemLabelled(root, "Setup guide").click();
    root.querySelector<HTMLButtonElement>(".pz-button--primary")!.click();
    await vi.waitFor(() => expect(root.textContent).toContain("Ready"));

    expect(create).toHaveBeenCalledTimes(1);
    const stored = await fakeBrowser.storage.local.get("popupState");
    expect(stored.popupState).toMatchObject({ nano: { status: "ready", percent: 100 } });
  });

  it("follows a download that another context already started", async () => {
    stubLanguageModel("downloading", 0.25);
    const root = await mount();
    await vi.waitFor(() => expect(root.textContent).toContain("Setting up"));

    const stored = await fakeBrowser.storage.local.get("popupState");
    expect(stored.popupState).toMatchObject({ nano: { status: "ready" } });
  });

  it("groups the model picker under provider legends with a hidden placeholder", async () => {
    const root = await mount();
    navItemLabelled(root, "Models & keys").click();
    root.querySelector<HTMLButtonElement>(".pz-model-slot--empty")!.click();

    const select = root.querySelector<HTMLSelectElement>(".pz-select")!;
    const legends = [...select.querySelectorAll("optgroup > legend")].map((legend) => legend.textContent);
    expect(legends).toContain("Anthropic");
    expect(select.querySelector<HTMLOptionElement>('option[value=""]')!.hidden).toBe(true);
    expect(select.closest(".pz-model-slot")!.querySelector(".pz-model-slot__header")).not.toBeNull();
  });

  it("tests a provider key in place and shows the rejection in the hint slot", async () => {
    const root = await mount();
    navItemLabelled(root, "Providers & keys").click();
    const openAiRow = [...root.querySelectorAll<HTMLButtonElement>(".pz-provider-row--button")].find((row) =>
      row.textContent?.includes("OpenAI"),
    )!;
    openAiRow.click();

    const panel = root.querySelector<HTMLElement>(".pz-provider-panel")!;
    const input = panel.querySelector<HTMLInputElement>("input")!;
    expect(panel.querySelector("label")!.getAttribute("for")).toBe(input.id);

    input.value = "short";
    const save = panel.querySelector<HTMLButtonElement>(".pz-button--primary")!;
    save.click();
    expect(save.getAttribute("aria-busy")).toBe("true");
    expect(save.textContent).toContain("Save & test");

    await vi.waitFor(() => expect(input.getAttribute("aria-invalid")).toBe("true"));
    expect(save.hasAttribute("aria-busy")).toBe(false);
    expect(panel.querySelector(".pz-provider-panel__hint")!.textContent).toContain("didn't accept this key");
    expect(input.value).toBe("short");

    panel.querySelector<HTMLButtonElement>(".pz-button--text")!.click();
    expect(root.querySelector(".pz-provider-panel")).toBeNull();
  });

  it("opens the key field when replacing a connected provider's key", async () => {
    const root = await mount();
    navItemLabelled(root, "Providers & keys").click();
    [...root.querySelectorAll<HTMLButtonElement>(".pz-provider-row--button")]
      .find((row) => row.textContent?.includes("OpenAI"))!
      .click();
    root.querySelector<HTMLInputElement>(".pz-provider-panel input")!.value = "test-key-1234";
    root.querySelector<HTMLButtonElement>(".pz-provider-panel .pz-button--primary")!.click();
    await vi.waitFor(() => expect(root.querySelector('[aria-label="Manage OpenAI"]')).not.toBeNull());
    root.querySelector<HTMLButtonElement>('[aria-label="Manage OpenAI"]')!.click();
    [...root.querySelectorAll<HTMLButtonElement>(".pz-button")]
      .find((node) => node.textContent === "Replace key")!
      .click();

    const panel = root.querySelector<HTMLElement>(".pz-provider-panel")!;
    expect(panel.querySelector("input")).not.toBeNull();
    panel.querySelector<HTMLButtonElement>(".pz-button--text")!.click();
    expect(root.querySelector(".pz-provider-panel")).toBeNull();
  });

  it("offers Turn all on in the Platforms header once every platform is off", async () => {
    const root = await mount();
    navItemLabelled(root, "Platforms").click();
    expect(root.querySelector(".pz-header-sub .pz-button")).toBeNull();

    const checkedToggles = () =>
      root.querySelectorAll<HTMLButtonElement>('.pz-platform-row .pz-toggle[aria-checked="true"]');
    while (checkedToggles().length > 0) {
      const remaining = checkedToggles().length;
      checkedToggles()[0]!.click();
      await vi.waitFor(() => expect(checkedToggles().length).toBeLessThan(remaining));
    }
    await vi.waitFor(() => expect(root.querySelector(".pz-header-sub .pz-button")).not.toBeNull());
    root.querySelector<HTMLButtonElement>(".pz-header-sub .pz-button")!.click();
    await vi.waitFor(() => expect(root.querySelector(".pz-header-sub .pz-button")).toBeNull());
  });

  it("reports the on-device model as ready on the setup guide rail item", async () => {
    const root = await mount();

    expect(navItemLabelled(root, "Setup guide").getAttribute("aria-label")).toContain("Ready");
  });
});
