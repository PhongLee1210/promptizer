import { el, iconEl } from "../dom";
import { button, headerSub, iconButton, screenShell, sectionHeading, toggle } from "../components";
import { countEnabledPlatforms } from "../main-view";
import { addCurrentSiteAsPlatform, canAddCurrentTab } from "../site-actions";
import { platformLogoFor } from "../platforms";
import type { Dispatch } from "../types";

export function renderPlatformsScreen(dispatch: Dispatch): HTMLElement {
  const state = dispatch.getState();
  const counts = countEnabledPlatforms(state);

  const rows = state.platforms.map((platform) =>
    el("div", { class: "pz-platform-row" }, [
      el("span", { class: "pz-platform-row__logo", "aria-hidden": "true" }, [iconEl(platformLogoFor(platform.id), 20)]),
      el("div", { class: "pz-platform-row__labels" }, [
        el("span", { class: "pz-body" }, [platform.label]),
        el("span", { class: "pz-micro pz-text-muted pz-platform-row__host" }, [platform.hostname]),
      ]),
      toggle({
        id: `pz-platform-${platform.id}`,
        checked: platform.enabled,
        label: `Suggest on ${platform.label}`,
        onChange: async (checked) => {
          await dispatch.updateState((s) => ({
            ...s,
            platforms: s.platforms.map((p) => (p.id === platform.id ? { ...p, enabled: checked } : p)),
          }));
        },
      }),
      platform.builtin
        ? el("span", {})
        : iconButton({
            iconName: "close",
            label: `Remove ${platform.label}`,
            size: 16,
            extraClass: "pz-icon-button--small",
            onClick: async () => {
              await dispatch.updateState((s) => ({ ...s, platforms: s.platforms.filter((p) => p.id !== platform.id) }));
            },
          }),
    ]),
  );

  const addButton = button({
    label: "Add the site in this tab",
    variant: "dashed",
    iconName: "plus",
    disabled: !canAddCurrentTab(dispatch),
    onClick: async () => {
      await addCurrentSiteAsPlatform(dispatch);
    },
  });

  const turnAllOn =
    counts.enabled === 0 && state.platforms.length > 0
      ? button({
          label: "Turn all on",
          variant: "text",
          compact: true,
          onClick: async () => {
            await dispatch.updateState((s) => ({ ...s, platforms: s.platforms.map((p) => ({ ...p, enabled: true })) }));
          },
        })
      : undefined;

  const body: (Node | string)[] = [
    sectionHeading("Where", "Suggests inside the message box."),
    el("div", { class: "pz-list" }, rows),
    addButton,
  ];

  return screenShell(
    headerSub({
      title: "Platforms",
      count: `${counts.enabled} of ${counts.total} on`,
      action: turnAllOn,
    }),
    body,
  );
}
