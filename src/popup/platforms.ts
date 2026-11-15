export interface BuiltinPlatform {
  id: string;
  label: string;
  hostname: string;
  monogram: string;
}

export const BUILTIN_PLATFORMS: BuiltinPlatform[] = [
  { id: "claude", label: "Claude", hostname: "claude.ai", monogram: "C" },
  { id: "chatgpt", label: "ChatGPT", hostname: "chatgpt.com", monogram: "Ch" },
  { id: "gemini", label: "Gemini", hostname: "gemini.google.com", monogram: "G" },
  { id: "perplexity", label: "Perplexity", hostname: "perplexity.ai", monogram: "P" },
  { id: "copilot", label: "Copilot", hostname: "copilot.microsoft.com", monogram: "Co" },
  { id: "deepseek", label: "DeepSeek", hostname: "chat.deepseek.com", monogram: "D" },
];

export function findPlatformByHostname(hostname: string): BuiltinPlatform | undefined {
  const normalized = hostname.toLowerCase();
  return BUILTIN_PLATFORMS.find(
    (platform) => normalized === platform.hostname || normalized.endsWith(`.${platform.hostname}`),
  );
}

export function monogramFor(label: string): string {
  const words = label.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0]!.charAt(0) + words[1]!.charAt(0)).toUpperCase();
  }
  return label.slice(0, 2);
}
