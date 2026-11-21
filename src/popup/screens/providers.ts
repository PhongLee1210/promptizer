import { el, iconEl } from "../dom";
import { button, headerSub, iconButton, screenShell, setButtonBusy, statusPill } from "../components";
import { testProviderKey } from "../provider-test";
import type { ProviderEntry } from "../state-types";
import { countConnectedProviders } from "../main-view";
import type { Dispatch } from "../types";

let expandedProviderId: string | null = null;
let removeConfirmId: string | null = null;
let replacingKeyId: string | null = null;

function closeKeyField(): void {
  expandedProviderId = null;
  replacingKeyId = null;
}

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
      extraClass: "pz-icon-button--small",
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
          compact: true,
          onClick: () => {
            removeConfirmId = null;
            rerender(dispatch);
          },
        }),
        button({
          label: "Remove",
          variant: "danger",
          compact: true,
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
        compact: true,
        onClick: () => {
          removeConfirmId = null;
          expandedProviderId = null;
          replacingKeyId = provider.id;
          rerender(dispatch);
        },
      }),
      button({
        label: "Remove",
        variant: "danger",
        compact: true,
        onClick: () => {
          removeConfirmId = provider.id;
          rerender(dispatch);
        },
      }),
    ]),
  ]);
}

function keyField(provider: ProviderEntry, dispatch: Dispatch): HTMLElement {
  const inputId = `pz-key-${provider.id}`;
  const hintText = `Stored only in this browser. Sent only to ${provider.label}.`;
  const input = el("input", {
    id: inputId,
    type: "password",
    class: "pz-input pz-key-field__input",
    autocomplete: "off",
    spellcheck: "false",
  });
  const hint = el("p", { class: "pz-micro pz-text-muted pz-provider-panel__hint" }, [hintText]);
  let revealed = false;
  const eye = iconButton({
    iconName: "eye",
    label: "Show key",
    size: 18,
    extraClass: "pz-key-field__reveal",
    onClick: () => {
      revealed = !revealed;
      input.setAttribute("type", revealed ? "text" : "password");
      eye.setAttribute("aria-label", revealed ? "Hide key" : "Show key");
      eye.replaceChildren(iconEl(revealed ? "eye-off" : "eye", 18));
    },
  });

  function showHint(text: string, isError: boolean): void {
    hint.textContent = text;
    hint.classList.toggle("pz-danger-text", isError);
    hint.classList.toggle("pz-text-muted", !isError);
    if (isError) {
      input.setAttribute("aria-invalid", "true");
      dispatch.announce(text);
    } else {
      input.removeAttribute("aria-invalid");
    }
  }

  const saveButton = button({
    label: "Save & test",
    onClick: async () => {
      setButtonBusy(saveButton, true);
      showHint(hintText, false);
      const key = input.value;
      const result = await testProviderKey(key);
      setButtonBusy(saveButton, false);
      if (result === "success") {
        closeKeyField();
        await dispatch.updateState((s) => ({
          ...s,
          providers: s.providers.map((p) =>
            p.id === provider.id ? { ...p, status: "connected", keyLast4: key.slice(-4) } : p,
          ),
        }));
        return;
      }
      showHint(
        result === "invalid-key"
          ? `${provider.label} didn't accept this key. Check it and try again.`
          : `Couldn't reach ${provider.label}. Your key wasn't checked.`,
        true,
      );
    },
  });

  const cancelButton = button({
    label: "Cancel",
    variant: "text",
    onClick: () => {
      closeKeyField();
      rerender(dispatch);
    },
  });

  return el("div", { class: "pz-provider-panel" }, [
    el("p", { class: "pz-body-strong" }, [provider.label]),
    el("label", { class: "pz-field-label pz-caption", for: inputId }, ["API key"]),
    el("div", { class: "pz-key-field" }, [input, eye]),
    hint,
    el("div", { class: "pz-row-actions" }, [cancelButton, saveButton]),
  ]);
}

export function renderProvidersScreen(dispatch: Dispatch): HTMLElement {
  const state = dispatch.getState();

  const rows = state.providers.map((provider) => {
    if (provider.builtin) {
      return builtinRow(provider);
    }
    const isEditingKey =
      replacingKeyId === provider.id || (provider.status === "not-connected" && expandedProviderId === provider.id);
    if (isEditingKey) {
      return keyField(provider, dispatch);
    }
    if (provider.status === "not-connected") {
      const row = el("button", { class: "pz-provider-row pz-provider-row--button pz-control" }, [
        el("div", { class: "pz-provider-row__labels" }, [
          el("span", { class: "pz-body-strong" }, [provider.label]),
          el("span", { class: "pz-caption pz-text-muted" }, [provider.sublabel]),
        ]),
        el("span", { class: "pz-caption pz-text-muted" }, ["Not connected"]),
        iconEl("chevron-right", 18),
      ]);
      row.addEventListener("click", () => {
        expandedProviderId = provider.id;
        rerender(dispatch);
      });
      return row;
    }
    return connectedSummary(provider, dispatch);
  });

  const backLink = button({
    label: "Model order",
    variant: "text",
    iconName: "chevron-left",
    compact: true,
    onClick: () => dispatch.goTo("models"),
  });
  backLink.classList.add("pz-back-link");
  const cloudProviderCount = state.providers.filter((provider) => !provider.builtin).length;

  return screenShell(
    headerSub({
      title: "Providers & keys",
      count: `${countConnectedProviders(state)} of ${cloudProviderCount} connected`,
    }),
    [
      backLink,
      el("div", { class: "pz-list" }, rows),
      el("p", { class: "pz-footer-note pz-micro" }, ["A connected provider's models appear in Model order."]),
    ],
  );
}
