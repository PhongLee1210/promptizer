import type { PopupState } from "./state-types";

export type PopupScreen = "main" | "platforms" | "models" | "providers" | "suggestions" | "nano-setup";

export interface Dispatch {
  getState(): PopupState;
  getActiveHostname(): string | undefined;
  getScreen(): PopupScreen;
  updateState(mutator: (state: PopupState) => PopupState): Promise<void>;
  announce(message: string): void;
  rerender(): void;
  goTo(screen: PopupScreen): void;
  refreshNano(): Promise<void>;
  startNanoDownload(): Promise<void>;
}
