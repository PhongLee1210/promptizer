import { el, iconEl } from "../dom";
import { button, headerSub, iconButton, screenShell, statusPill } from "../components";
import { testProviderKey } from "../provider-test";
import type { ProviderEntry } from "../state-types";
import type { Dispatch } from "../types";

let expandedProviderId: string | null = null;
let removeConfirmId: string | null = null;
let testingProviderId: string | null = null;
let testErrorByProvider: Record<string, string> = {};

function rerender(dispatch: Dispatch): void {
  dispatch.rerender();
}

function builtinRow(provider: ProviderEntry): HTMLElement {
  return el("div", { class: "pz-provider-row" }, [
    el("div", { class: "pz-provider-row__labels" }, [
      el("span", { class: "pz-body-strong" }, [provider.label]),
      el("span", { class: "pz-caption pz-text-muted" }, [provider.sublabel]),
    ]),
    statusPill("Ready", "ready"),
  ]);
}

function connectedSummary(provider: ProviderEntry, dispatch: Dispatch): HTMLElement {
  const row = el("div", { class: "pz-provider-row" }, [
    el("div", { class: "pz-provider-row__labels" }, [
      el("span", { class: "pz-body-strong" }, [provider.label]),
      el("span", { class: "pz-caption pz-text-muted" }, [`Key ending ${provider.keyLast4 ?? "----"}`]),
    ]),
    statusPill(
      provider.status === "warning" ? "Attention" : "Connected",
      provider.status === "warning" ? "warning" : "ready",
    ),
    iconButton({
      iconName: "more",
      label: `Manage ${provider.label}`,
      size: 18,
      onClick: () => {
        expandedProviderId = expandedProviderId === provider.id ? null : provider.id;
        rerender(dispatch);
      },
    }),
  ]);

  if (expandedProviderId !== provider.id) {
    return row;
  }

  if (removeConfirmId === provider.id) {
    return el("div", { class: "pz-provider-row pz-provider-row--expanded" }, [
      row,
      el("p", { class: "pz-body" }, [`Remove this key? ${provider.label} will be skipped until you add one.`]),
      el("div", { class: "pz-row-actions" }, [
        button({
          label: "Cancel",
          variant: "text",
          onClick: () => {
            removeConfirmId = null;
            rerender(dispatch);
          },
        }),
        button({
          label: "Remove",
          variant: "outline",
          onClick: async () => {
            removeConfirmId = null;
            expandedProviderId = null;
            await dispatch.updateState((s) => ({
              ...s,
              providers: s.providers.map((p) =>
                p.id === provider.id ? { ...p, status: "not-connected", keyLast4: undefined } : p,
              ),
            }));
          },
        }),
      ]),
    ]);
  }

  return el("div", { class: "pz-provider-row pz-provider-row--expanded" }, [
    row,
    el("div", { class: "pz-row-actions" }, [
      button({
        label: "Replace key",
        variant: "text",
        onClick: () => {
          removeConfirmId = null;
          rerender(dispatch);
        },
      }),
      button({
        label: "Remove",
        variant: "text",
        onClick: () => {
          removeConfirmId = provider.id;
          rerender(dispatch);
        },
      }),
    ]),
  ]);
}

function keyField(provider: ProviderEntry, dispatch: Dispatch): HTMLElement {
  const input = el("input", {
    type: "password",
    class: "pz-input",
    autocomplete: "off",
    spellcheck: "false",
    "aria-label": `${provider.label} API key`,
  });
  let revealed = false;
  const eye = iconButton({
    iconName: "eye",
    label: "Show key",
    size: 18,
    onClick: () => {
      revealed = !revealed;
      input.setAttribute("type", revealed ? "text" : "password");
      eye.setAttribute("aria-label", revealed ? "Hide key" : "Show key");
      eye.replaceChildren(iconEl(revealed ? "eye-off" : "eye", 18));
    },
  });

  const isTesting = testingProviderId === provider.id;
  const error = testErrorByProvider[provider.id];

  const saveButton = button({
    label: isTesting ? "Testing…" : "Save & test",
    disabled: isTesting,
    onClick: async () => {
      testingProviderId = provider.id;
      delete testErrorByProvider[provider.id];
      rerender(dispatch);
      const result = await testProviderKey(input.value);
      testingProviderId = null;
      if (result === "success") {
        expandedProviderId = null;
        await dispatch.updateState((s) => ({
          ...s,
          providers: s.providers.map((p) =>
            p.id === provider.id ? { ...p, status: "connected", keyLast4: input.value.slice(-4) } : p,
          ),
        }));
      } else {
        testErrorByProvider[provider.id] =
          result === "invalid-key"
            ? `${provider.label} didn't accept this key. Check it and try again.`
            : `Couldn't reach ${provider.label}. Your key wasn't checked.`;
        rerender(dispatch);
      }
    },
  });

  const children: (Node | string)[] = [
    el("p", { class: "pz-body-strong" }, [provider.label]),
    el("p", { class: "pz-caption pz-text-muted" }, [provider.sublabel]),
    el("label", { class: "pz-field-label pz-caption" }, ["API key"]),
    el("div", { class: "pz-key-field" }, [input, eye, saveButton]),
    el("p", { class: "pz-micro pz-text-muted" }, [`Stored only in this browser. Sent only to ${provider.label}.`]),
  ];
  if (error !== undefined) {
    children.push(el("p", { class: "pz-caption pz-danger-text", role: "alert" }, [error]));
  }

  return el("div", { class: "pz-provider-row pz-provider-row--expanded" }, children);
}

export function renderProvidersScreen(dispatch: Dispatch): HTMLElement {
  const state = dispatch.getState();

  const rows = state.providers.map((provider) => {
    if (provider.builtin) {
      return builtinRow(provider);
    }
    if (provider.status === "not-connected" && expandedProviderId === provider.id) {
      return keyField(provider, dispatch);
    }
    if (provider.status === "not-connected") {
      const row = el("button", { class: "pz-provider-row pz-provider-row--button pz-control" }, [
        el("div", { class: "pz-provider-row__labels" }, [
          el("span", { class: "pz-body-strong" }, [provider.label]),
          el("span", { class: "pz-caption pz-text-muted" }, [provider.sublabel]),
        ]),
        el("span", { class: "pz-caption pz-text-muted" }, ["Not connected"]),
      ]);
      row.addEventListener("click", () => {
        expandedProviderId = provider.id;
        rerender(dispatch);
      });
      return row;
    }
    return connectedSummary(provider, dispatch);
  });

  return screenShell(
    headerSub({
      title: "Providers & keys",
      drawerOpen: dispatch.isDrawerOpen(),
      onMenuClick: () => dispatch.openDrawer(),
    }),
    [
      button({ label: "Back to model order", variant: "text", onClick: () => dispatch.goTo("models") }),
      el("div", { class: "pz-list" }, rows),
      el("p", { class: "pz-footer-note pz-micro" }, ["A connected provider's models appear in Model order."]),
    ],
  );
}
