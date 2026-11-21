import type { IconName } from "../utils/icons";

export interface BuiltinPlatform {
  id: string;
  label: string;
  hostname: string;
  logo: IconName;
}

export const BUILTIN_PLATFORMS: BuiltinPlatform[] = [
  { id: "claude", label: "Claude", hostname: "claude.ai", logo: "logo-claude" },
  { id: "chatgpt", label: "ChatGPT", hostname: "chatgpt.com", logo: "logo-chatgpt" },
  { id: "gemini", label: "Gemini", hostname: "gemini.google.com", logo: "logo-gemini" },
  { id: "perplexity", label: "Perplexity", hostname: "perplexity.ai", logo: "logo-perplexity" },
  { id: "copilot", label: "Copilot", hostname: "copilot.microsoft.com", logo: "logo-copilot" },
  { id: "deepseek", label: "DeepSeek", hostname: "chat.deepseek.com", logo: "logo-deepseek" },
];

const CUSTOM_PLATFORM_LOGO: IconName = "globe";

export function findPlatformByHostname(hostname: string): BuiltinPlatform | undefined {
  const normalized = hostname.toLowerCase();
  return BUILTIN_PLATFORMS.find(
    (platform) => normalized === platform.hostname || normalized.endsWith(`.${platform.hostname}`),
  );
}

export function platformLogoFor(platformId: string): IconName {
  return BUILTIN_PLATFORMS.find((platform) => platform.id === platformId)?.logo ?? CUSTOM_PLATFORM_LOGO;
}
