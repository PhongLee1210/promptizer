import type { Dispatch } from "./types";

export async function addCurrentSiteAsPlatform(dispatch: Dispatch): Promise<void> {
  const hostname = dispatch.getActiveHostname();
  if (hostname === undefined) {
    return;
  }
  await dispatch.updateState((state) => {
    if (state.platforms.some((platform) => hostname === platform.hostname)) {
      return state;
    }
    return {
      ...state,
      platforms: [...state.platforms, { id: hostname, label: hostname, hostname, enabled: true, builtin: false }],
    };
  });
  dispatch.announce(`${hostname} added`);
}

export function canAddCurrentTab(dispatch: Dispatch): boolean {
  const hostname = dispatch.getActiveHostname();
  if (hostname === undefined) {
    return false;
  }
  return !dispatch.getState().platforms.some((platform) => hostname === platform.hostname);
}
