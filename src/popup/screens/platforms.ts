import { el } from "../dom";
import { button, emptyState, headerSub, iconButton, screenShell, sectionHeading, toggle } from "../components";
import { countEnabledPlatforms } from "../main-view";
import { addCurrentSiteAsPlatform, canAddCurrentTab } from "../site-actions";
import { monogramFor } from "../platforms";
import type { Dispatch } from "../types";

export function renderPlatformsScreen(dispatch: Dispatch): HTMLElement {
  const state = dispatch.getState();
  const counts = countEnabledPlatforms(state);

  const rows = state.platforms.map((platform) =>
    el("div", { class: "pz-platform-row" }, [
      el("span", { class: "pz-platform-row__monogram", "aria-hidden": "true" }, [monogramFor(platform.label)]),
      el("div", { class: "pz-platform-row__labels" }, [
        el("span", { class: "pz-body" }, [platform.label]),
        el("span", { class: "pz-micro pz-text-muted" }, [platform.hostname]),
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

  const body: (Node | string)[] = [
    sectionHeading("Where", "Promptizer suggests inside the message box on the sites you switch on."),
  ];

  if (state.platforms.length === 0 || counts.enabled === 0) {
    body.push(
      emptyState({
        illustration: "–",
        text: "No platforms are on, so nothing is suggested.",
        action: button({
          label: "Turn all on",
          variant: "outline",
          onClick: async () => {
            await dispatch.updateState((s) => ({ ...s, platforms: s.platforms.map((p) => ({ ...p, enabled: true })) }));
          },
        }),
      }),
    );
  }

  body.push(el("div", { class: "pz-list" }, rows), addButton);

  return screenShell(
    headerSub({
      title: "Platforms",
      count: `${counts.enabled} of ${counts.total} on`,
      drawerOpen: dispatch.isDrawerOpen(),
      onMenuClick: () => dispatch.openDrawer(),
    }),
    body,
  );
}
