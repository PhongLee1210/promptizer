export type AutoSaveStatus = "idle" | "pending" | "saving" | "saved" | "failed";

export interface AutoSaveState {
  status: AutoSaveStatus;
  failureMessage?: string;
  canRetry: boolean;
  savedAt?: number;
}

export type SaveResult = { ok: true } | { ok: false; message: string; retryable: boolean };

export interface AutoSaveTimers {
  setTimeout(run: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface AutoSaverOptions<Draft> {
  initialDraft: Draft;
  delayMs: number;
  save(draft: Draft, mode: { keepalive: boolean }): Promise<SaveResult>;
  isSameDraft(first: Draft, second: Draft): boolean;
  onStateChange(state: AutoSaveState): void;
  timers?: AutoSaveTimers;
  now?: () => number;
}

export interface AutoSaver<Draft> {
  edit(draft: Draft): void;
  retry(): void;
  flush(): void;
  stop(): void;
  hasUnsavedChanges(): boolean;
  readonly state: AutoSaveState;
}

export const AUTO_SAVE_DELAY_MS = 800;
export const UNREACHABLE_SAVE_MESSAGE = "Couldn't save. Check your connection and try again.";

const DEFAULT_TIMERS: AutoSaveTimers = {
  setTimeout: (run, delayMs) => globalThis.setTimeout(run, delayMs),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>),
};

export function createAutoSaver<Draft>(options: AutoSaverOptions<Draft>): AutoSaver<Draft> {
  const timers = options.timers ?? DEFAULT_TIMERS;
  const now = options.now ?? Date.now;
  let state: AutoSaveState = { status: "idle", canRetry: false };
  let currentDraft = options.initialDraft;
  let lastSavedDraft = options.initialDraft;
  let timerHandle: unknown;
  let saveInFlight = false;
  let saveQueued = false;
  let flushAfterSave = false;
  let stopped = false;

  const isDirty = () => !options.isSameDraft(currentDraft, lastSavedDraft);

  function setState(next: AutoSaveState) {
    state = next;
    if (!stopped) {
      options.onStateChange(state);
    }
  }

  function settledState(): AutoSaveState {
    return { status: state.savedAt === undefined ? "idle" : "saved", canRetry: false, savedAt: state.savedAt };
  }

  function clearTimer() {
    if (timerHandle !== undefined) {
      timers.clearTimeout(timerHandle);
      timerHandle = undefined;
    }
  }

  function finishSave(draft: Draft, result: SaveResult) {
    saveInFlight = false;
    if (result.ok) {
      lastSavedDraft = draft;
    }
    if (flushAfterSave) {
      flushAfterSave = false;
      if (isDirty()) {
        startSave(true);
        return;
      }
    }
    if (stopped) {
      return;
    }
    if (!result.ok) {
      saveQueued = false;
      setState({
        status: "failed",
        failureMessage: result.message,
        canRetry: result.retryable,
        savedAt: state.savedAt,
      });
      return;
    }
    const savedAt = now();
    if (saveQueued) {
      saveQueued = false;
      state = { ...state, savedAt };
      startSave(false);
      return;
    }
    setState({ status: timerHandle === undefined ? "saved" : "pending", canRetry: false, savedAt });
  }

  function startSave(keepalive: boolean) {
    if (!isDirty()) {
      setState(settledState());
      return;
    }
    const draft = currentDraft;
    saveInFlight = true;
    setState({ status: "saving", canRetry: false, savedAt: state.savedAt });
    options.save(draft, { keepalive }).then(
      (result) => finishSave(draft, result),
      () => finishSave(draft, { ok: false, message: UNREACHABLE_SAVE_MESSAGE, retryable: true }),
    );
  }

  function saveWhenTimerFires() {
    timerHandle = undefined;
    if (saveInFlight) {
      saveQueued = true;
      return;
    }
    startSave(false);
  }

  return {
    edit(draft) {
      if (stopped) return;
      currentDraft = draft;
      clearTimer();
      if (!isDirty() && !saveInFlight) {
        setState(settledState());
        return;
      }
      timerHandle = timers.setTimeout(saveWhenTimerFires, options.delayMs);
      if (!saveInFlight) {
        setState({ status: "pending", canRetry: false, savedAt: state.savedAt });
      }
    },
    retry() {
      if (stopped || state.status !== "failed" || !state.canRetry) return;
      clearTimer();
      if (saveInFlight) {
        saveQueued = true;
        return;
      }
      startSave(false);
    },
    flush() {
      if (stopped) return;
      clearTimer();
      if (!isDirty()) return;
      if (saveInFlight) {
        flushAfterSave = true;
        return;
      }
      startSave(true);
    },
    stop() {
      clearTimer();
      saveQueued = false;
      stopped = true;
    },
    hasUnsavedChanges: isDirty,
    get state() {
      return state;
    },
  };
}
