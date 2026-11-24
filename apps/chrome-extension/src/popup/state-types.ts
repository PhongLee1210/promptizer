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

export type NanoSetupStatus = "unknown" | "ready" | "needs-download" | "downloading" | "unsupported";

export interface NanoState {
  status: NanoSetupStatus;
  percent: number;
}

export const STORAGE_SCHEMA = 3;

export interface PopupState {
  schema: number;
  globalEnabled: boolean;
  platforms: PlatformEntry[];
  modelOrder: ModelSlot[];
  switchTimeoutSeconds: number;
  providers: ProviderEntry[];
  suggest: SuggestSettings;
  railCollapsed: Record<string, boolean>;
  nano: NanoState;
}

export function defaultNanoState(): NanoState {
  return { status: "unknown", percent: 0 };
}

export function nanoModelStatus(nano: NanoState): ModelStatus {
  if (nano.status === "downloading") {
    return "downloading";
  }
  if (nano.status === "needs-download" || nano.status === "unsupported") {
    return "unavailable";
  }
  return "ready";
}

export function nanoStatusLabel(nano: NanoState): string {
  switch (nano.status) {
    case "ready":
      return "Ready";
    case "downloading":
      return `Downloading ${nano.percent}%`;
    case "needs-download":
      return "Download needed";
    case "unsupported":
      return "Not available here";
    default:
      return "Checking";
  }
}

export function nanoNeedsAttention(nano: NanoState): boolean {
  return nano.status === "needs-download" || nano.status === "unsupported" || nano.status === "downloading";
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

export function statusForProvider(provider: ProviderEntry, nano: NanoState = defaultNanoState()): ModelStatus {
  if (provider.id === "gemini-nano") {
    return nanoModelStatus(nano);
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
      if (provider === undefined) {
        return slot;
      }
      const status = statusForProvider(provider, state.nano);
      return status === "downloading" ? { ...slot, status, downloadPercent: state.nano.percent } : { ...slot, status };
    }),
  };
}

export function defaultPopupState(): PopupState {
  return {
    schema: STORAGE_SCHEMA,
    globalEnabled: true,
    suggest: defaultSuggestSettings(),
    railCollapsed: {},
    nano: defaultNanoState(),
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
