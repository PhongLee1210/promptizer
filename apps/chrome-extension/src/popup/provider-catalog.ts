import type { ModelDevice } from "./state-types";

export interface CatalogModel {
  providerId: string;
  providerLabel: string;
  modelName: string;
  device: ModelDevice;
}

export const PROVIDER_CATALOG: CatalogModel[] = [
  { providerId: "gemini-nano", providerLabel: "On-device", modelName: "Gemini Nano", device: "on-device" },
  { providerId: "anthropic", providerLabel: "Anthropic", modelName: "Claude Haiku", device: "cloud" },
  { providerId: "anthropic", providerLabel: "Anthropic", modelName: "Claude Sonnet", device: "cloud" },
  { providerId: "openrouter", providerLabel: "OpenRouter", modelName: "Auto", device: "cloud" },
  { providerId: "openai", providerLabel: "OpenAI", modelName: "GPT-4o mini", device: "cloud" },
];
