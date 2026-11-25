export type DeviceClass = "mobile" | "desktop";

const MOBILE_UA_PATTERN = /Android.+Mobile|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|webOS/i;

export const MOBILE_SPLIT_ROUTES = ["/", "/prompts", "/prompts/new", "/packs", "/account/password"] as const;

export function classifyDevice(userAgent: string | null): DeviceClass {
  return userAgent !== null && MOBILE_UA_PATTERN.test(userAgent) ? "mobile" : "desktop";
}

export function isMobileSplitRoute(pathname: string): boolean {
  return MOBILE_SPLIT_ROUTES.some((route) => (route === "/" ? pathname === "/" : pathname === route));
}
