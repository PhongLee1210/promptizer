const DEFAULT_DESTINATION = "/";

export function safeDestination(candidate: string | string[] | undefined): string {
  if (typeof candidate !== "string") {
    return DEFAULT_DESTINATION;
  }
  const isSameOriginPath = candidate.startsWith("/") && !candidate.startsWith("//") && !candidate.includes("\\");
  return isSameOriginPath ? candidate : DEFAULT_DESTINATION;
}

export function signInUrlFor(destination: string): string {
  return `/sign-in?next=${encodeURIComponent(destination)}`;
}
