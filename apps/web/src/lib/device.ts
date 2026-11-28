export type DeviceClass = "mobile" | "desktop";

const MOBILE_UA_PATTERN = /Android.+Mobile|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|webOS/i;

export const MOBILE_SPLIT_ROUTES = [
  "/",
  "/prompts",
  "/prompts/new",
  "/prompts/[id]",
  "/prompts/[id]/edit",
  "/prompts/[id]/delete",
  "/packs",
  "/packs/new",
  "/packs/[id]/edit",
  "/packs/[id]/delete",
  "/account/password",
] as const;

export function classifyDevice(userAgent: string | null): DeviceClass {
  return userAgent !== null && MOBILE_UA_PATTERN.test(userAgent) ? "mobile" : "desktop";
}

function isDynamicSegment(segment: string): boolean {
  return segment.startsWith("[") && segment.endsWith("]");
}

export function matchesRoutePattern(route: string, pathname: string): boolean {
  if (route === "/" || pathname === "/") {
    return route === pathname;
  }
  const routeSegments = route.split("/");
  const pathSegments = pathname.split("/");
  return (
    routeSegments.length === pathSegments.length &&
    routeSegments.every(
      (segment, index) => segment === pathSegments[index] || (isDynamicSegment(segment) && pathSegments[index] !== ""),
    )
  );
}

export function isMobileSplitRoute(pathname: string): boolean {
  return MOBILE_SPLIT_ROUTES.some((route) => matchesRoutePattern(route, pathname));
}
