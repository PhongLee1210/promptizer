export type ModelStatus = "ready" | "downloading" | "key-needed" | "unavailable" | "error";

export type ModelDevice = "on-device" | "cloud";

export interface ModelSlot {
  providerId: string;
  providerLabel: string;
  modelName: string;
  device: ModelDevice;
  status: ModelStatus;
  downloadPercent?: number;
}

export interface PlatformEntry {
  id: string;
  label: string;
  hostname: string;
  enabled: boolean;
  builtin: boolean;
}

export type ProviderKeyStatus = "not-connected" | "connected" | "warning";

export interface ProviderEntry {
  id: string;
  label: string;
  builtin: boolean;
  status: ProviderKeyStatus;
  keyLast4?: string;
  sublabel: string;
}

export type SuggestMode = "live" | "onRequest";

export type SuggestCategory = "clarity" | "gap" | "conflict";

export interface SuggestSettings {
  mode: SuggestMode;
  cloudLive: boolean;
  categories: Record<SuggestCategory, boolean>;
  underlines: boolean;
}

export const STORAGE_SCHEMA = 2;

export interface PopupState {
  schema: number;
  globalEnabled: boolean;
  platforms: PlatformEntry[];
  modelOrder: ModelSlot[];
  switchTimeoutSeconds: number;
  providers: ProviderEntry[];
  suggest: SuggestSettings;
  railCollapsed: Record<string, boolean>;
}

export function defaultSuggestSettings(): SuggestSettings {
  return {
    mode: "live",
    cloudLive: false,
    categories: { clarity: true, gap: true, conflict: true },
    underlines: true,
  };
}

export function hasConnectedCloudProvider(state: PopupState): boolean {
  return state.providers.some((provider) => !provider.builtin && provider.status === "connected");
}

export function allCategoriesOff(settings: SuggestSettings): boolean {
  return !settings.categories.clarity && !settings.categories.gap && !settings.categories.conflict;
}

export const SWITCH_TIMEOUT_OPTIONS = [3, 5, 10, 20] as const;

export function statusForProvider(provider: ProviderEntry): ModelStatus {
  if (provider.id === "gemini-nano") {
    return "ready";
  }
  if (provider.status === "connected") {
    return "ready";
  }
  if (provider.status === "warning") {
    return "error";
  }
  return "key-needed";
}

export function syncModelOrderStatus(state: PopupState): PopupState {
  const providersById = new Map(state.providers.map((provider) => [provider.id, provider]));
  return {
    ...state,
    modelOrder: state.modelOrder.map((slot) => {
      const provider = providersById.get(slot.providerId);
      return provider === undefined ? slot : { ...slot, status: statusForProvider(provider) };
    }),
  };
}

export function defaultPopupState(): PopupState {
  return {
    schema: STORAGE_SCHEMA,
    globalEnabled: true,
    suggest: defaultSuggestSettings(),
    railCollapsed: {},
    platforms: [],
    modelOrder: [
      {
        providerId: "gemini-nano",
        providerLabel: "On-device",
        modelName: "Gemini Nano",
        device: "on-device",
        status: "ready",
      },
    ],
    switchTimeoutSeconds: 5,
    providers: [
      {
        id: "gemini-nano",
        label: "Gemini Nano",
        builtin: true,
        status: "connected",
        sublabel: "Built into Chrome, no key needed",
      },
      {
        id: "anthropic",
        label: "Anthropic",
        builtin: false,
        status: "not-connected",
        sublabel: "Claude Haiku, Claude Sonnet",
      },
      {
        id: "openrouter",
        label: "OpenRouter",
        builtin: false,
        status: "not-connected",
        sublabel: "Auto-routed open models",
      },
      { id: "openai", label: "OpenAI", builtin: false, status: "not-connected", sublabel: "GPT models" },
    ],
  };
}
