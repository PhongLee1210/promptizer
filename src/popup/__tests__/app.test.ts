import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { mountPopup } from "../app";

async function mount(): Promise<HTMLElement> {
  const root = document.createElement("div");
  document.body.append(root);
  await mountPopup(root);
  return root;
}

function openDrawer(root: HTMLElement): void {
  root.querySelector<HTMLButtonElement>(".pz-menu-button")!.click();
}

function drawerItemLabelled(root: HTMLElement, label: string): HTMLButtonElement {
  const items = [...root.querySelectorAll<HTMLButtonElement>(".pz-drawer-item")];
  return items.find((item) => item.textContent?.includes(label))!;
}

describe("mountPopup", () => {
  beforeEach(() => {
    fakeBrowser.reset();
    localStorage.clear();
    vi.spyOn(fakeBrowser.runtime, "getManifest").mockReturnValue({
      version: "0.1.0",
    } as ReturnType<typeof fakeBrowser.runtime.getManifest>);
  });

  it("renders the main screen with the power button focused", async () => {
    const root = await mount();

    const power = root.querySelector<HTMLButtonElement>(".pz-power-button");
    expect(power?.getAttribute("aria-pressed")).toBe("true");
    expect(document.activeElement).toBe(power);
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

  it("opens the drawer from the hamburger, focuses its first item and closes it", async () => {
    const root = await mount();

    openDrawer(root);

    expect(root.querySelector(".pz-drawer")).not.toBeNull();
    expect(root.querySelector(".pz-menu-button")?.getAttribute("aria-expanded")).toBe("true");
    expect(root.textContent).toContain("Platforms");
    expect(root.textContent).toContain("Models & keys");
    expect(root.textContent).toContain("Suggestions");
    expect(document.activeElement).toBe(root.querySelector(".pz-drawer-item"));

    root.querySelector<HTMLButtonElement>(".pz-drawer__close")!.click();
    expect(root.querySelector('.pz-drawer-root[data-open="true"]')).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(root.querySelector(".pz-drawer-root")).toBeNull();
    expect(document.activeElement).toBe(root.querySelector(".pz-menu-button"));
  });

  it("takes the main content out of the tab order while the drawer is open", async () => {
    const root = await mount();
    const screenHost = root.children[1] as HTMLElement;

    openDrawer(root);
    expect(screenHost.inert).toBe(true);

    root.querySelector<HTMLButtonElement>(".pz-drawer__close")!.click();
    expect(screenHost.inert).toBe(false);
  });

  it("closes the drawer on Escape", async () => {
    const root = await mount();

    openDrawer(root);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(root.querySelector('.pz-drawer-root[data-open="true"]')).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(root.querySelector(".pz-drawer-root")).toBeNull();
  });

  it("closes the drawer when the backdrop is clicked", async () => {
    const root = await mount();

    openDrawer(root);
    root.querySelector<HTMLElement>(".pz-drawer-backdrop")!.click();

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(root.querySelector(".pz-drawer-root")).toBeNull();
  });

  it("navigates to the Platforms screen and marks it current in the drawer", async () => {
    const root = await mount();

    openDrawer(root);
    drawerItemLabelled(root, "Platforms").click();

    expect(root.querySelector(".pz-drawer-root")).not.toBeNull();
    expect(root.querySelector(".pz-header-sub")?.textContent).toContain("Platforms");
    expect(root.querySelector<HTMLButtonElement>("#pz-platform-claude")).not.toBeNull();

    openDrawer(root);
    expect(drawerItemLabelled(root, "Platforms").getAttribute("aria-current")).toBe("page");
  });

  it("navigates to the Suggestions screen and keeps its switches", async () => {
    const root = await mount();

    openDrawer(root);
    drawerItemLabelled(root, "Suggestions").click();

    expect(root.querySelector("#pz-suggest-mode")?.getAttribute("aria-checked")).toBe("true");
    expect(root.querySelector("#pz-suggest-clarity")?.getAttribute("aria-checked")).toBe("true");
    expect(root.querySelector("#pz-suggest-cloud-live")?.getAttribute("aria-disabled")).toBe("true");
    expect(root.textContent).toContain("No cloud model connected");
  });

  it("stores a suggestion category change under schema 2", async () => {
    const root = await mount();

    openDrawer(root);
    drawerItemLabelled(root, "Suggestions").click();
    root.querySelector<HTMLButtonElement>("#pz-suggest-gap")!.click();
    await Promise.resolve();
    await Promise.resolve();

    const stored = await fakeBrowser.storage.local.get("popupState");
    expect(stored.popupState).toMatchObject({ schema: 2, suggest: { categories: { gap: false } } });
  });

  it("opens the model screen from the main model card", async () => {
    const root = await mount();

    root.querySelector<HTMLButtonElement>(".pz-card--link")!.click();

    expect(root.querySelector(".pz-header-sub")?.textContent).toContain("Models & keys");
  });

  it("toggles a platform from the Platforms screen", async () => {
    const root = await mount();

    openDrawer(root);
    drawerItemLabelled(root, "Platforms").click();

    const claudeToggle = root.querySelector<HTMLButtonElement>("#pz-platform-claude")!;
    expect(claudeToggle.getAttribute("aria-checked")).toBe("true");
    claudeToggle.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(root.querySelector<HTMLButtonElement>("#pz-platform-claude")?.getAttribute("aria-checked")).toBe("false");
  });
});
