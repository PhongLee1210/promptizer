import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  directionFrom,
  evictTranslators,
  translateSelection,
  TRANSLATOR_IDLE_TIMEOUT_MS,
  type LanguageDetectorApi,
  type LanguageDetectionResult,
  type TranslatorApi,
  type TranslatorAvailability,
} from "../translator";

beforeEach(() => {
  evictTranslators();
});

function fakeDetectorApi(results: LanguageDetectionResult[], availability: TranslatorAvailability = "available") {
  const instance = { detect: vi.fn().mockResolvedValue(results), destroy: vi.fn() };
  const api = {
    availability: vi.fn().mockResolvedValue(availability),
    create: vi.fn().mockResolvedValue(instance),
  };
  return { api: api satisfies LanguageDetectorApi, instance };
}

function fakeTranslatorApi(translation = "Bộ trưởng...", availability: TranslatorAvailability = "available") {
  const instance = { translate: vi.fn().mockResolvedValue(translation), destroy: vi.fn() };
  const api = {
    availability: vi.fn().mockResolvedValue(availability),
    create: vi.fn().mockResolvedValue(instance),
  };
  return { api: api satisfies TranslatorApi, instance };
}

const ENGLISH = [{ detectedLanguage: "en", confidence: 0.9 }];

describe("directionFrom", () => {
  it("maps the highest-confidence English result to en→vi", () => {
    expect(directionFrom([{ detectedLanguage: "en", confidence: 0.9 }])).toEqual({ source: "en", target: "vi" });
  });

  it("maps Vietnamese to vi→en", () => {
    expect(directionFrom([{ detectedLanguage: "vi", confidence: 0.8 }])).toEqual({ source: "vi", target: "en" });
  });

  it("matches on the primary subtag", () => {
    expect(directionFrom([{ detectedLanguage: "en-US", confidence: 0.7 }])).toEqual({ source: "en", target: "vi" });
  });

  it("takes the highest-confidence result, not the first", () => {
    const results = [
      { detectedLanguage: "fr", confidence: 0.2 },
      { detectedLanguage: "vi", confidence: 0.9 },
    ];
    expect(directionFrom(results)).toEqual({ source: "vi", target: "en" });
  });

  it("returns null below the confidence floor", () => {
    expect(directionFrom([{ detectedLanguage: "en", confidence: 0.49 }])).toBeNull();
  });

  it("returns null for an unsupported language and for no results", () => {
    expect(directionFrom([{ detectedLanguage: "ja", confidence: 0.99 }])).toBeNull();
    expect(directionFrom([])).toBeNull();
  });
});

describe("translateSelection", () => {
  it("detects, translates, and reports the direction", async () => {
    const detector = fakeDetectorApi(ENGLISH);
    const translator = fakeTranslatorApi();
    const outcome = await translateSelection("The minister was reluctant.", {
      detectorApi: detector.api,
      translatorApi: translator.api,
    });
    expect(outcome).toEqual({ kind: "translated", direction: { source: "en", target: "vi" }, text: "Bộ trưởng..." });
    expect(translator.api.availability).toHaveBeenCalledWith({ sourceLanguage: "en", targetLanguage: "vi" });
  });

  it("returns unsupported-language without translating", async () => {
    const detector = fakeDetectorApi([{ detectedLanguage: "ja", confidence: 0.99 }]);
    const translator = fakeTranslatorApi();
    const outcome = await translateSelection("これは日本語です", {
      detectorApi: detector.api,
      translatorApi: translator.api,
    });
    expect(outcome).toEqual({ kind: "unsupported-language" });
    expect(translator.instance.translate).not.toHaveBeenCalled();
  });

  it("returns unsupported-language when the detector returns no results", async () => {
    const detector = fakeDetectorApi([]);
    const translator = fakeTranslatorApi();
    const outcome = await translateSelection("???", { detectorApi: detector.api, translatorApi: translator.api });
    expect(outcome).toEqual({ kind: "unsupported-language" });
    expect(translator.instance.translate).not.toHaveBeenCalled();
  });

  it("returns unavailable when the detector is unavailable", async () => {
    const detector = fakeDetectorApi(ENGLISH, "unavailable");
    const translator = fakeTranslatorApi();
    const outcome = await translateSelection("hello", { detectorApi: detector.api, translatorApi: translator.api });
    expect(outcome).toEqual({ kind: "unavailable" });
    expect(detector.api.create).not.toHaveBeenCalled();
  });

  it("returns unavailable when the APIs are absent", async () => {
    expect(await translateSelection("hello", {})).toEqual({ kind: "unavailable" });
  });

  it("returns error when create rejects with NotSupportedError", async () => {
    const detector = fakeDetectorApi(ENGLISH);
    const translator = fakeTranslatorApi();
    translator.api.create.mockRejectedValue(new DOMException("nope", "NotSupportedError"));
    const outcome = await translateSelection("hello", { detectorApi: detector.api, translatorApi: translator.api });
    expect(outcome).toEqual({ kind: "error" });
  });

  it("returns error when translate rejects", async () => {
    const detector = fakeDetectorApi(ENGLISH);
    const translator = fakeTranslatorApi();
    translator.instance.translate.mockRejectedValue(new Error("boom"));
    const outcome = await translateSelection("hello", { detectorApi: detector.api, translatorApi: translator.api });
    expect(outcome).toEqual({ kind: "error" });
  });

  it("reuses a cached translator for the same direction and creates each direction once", async () => {
    const detector = fakeDetectorApi(ENGLISH);
    const translator = fakeTranslatorApi();
    const options = { detectorApi: detector.api, translatorApi: translator.api };
    await translateSelection("hello", options);
    await translateSelection("world", options);
    expect(translator.api.create).toHaveBeenCalledTimes(2);
    expect(detector.api.create).toHaveBeenCalledTimes(1);

    detector.instance.detect.mockResolvedValue([{ detectedLanguage: "vi", confidence: 0.9 }]);
    await translateSelection("xin chào", options);
    expect(translator.api.create).toHaveBeenCalledTimes(2);
  });

  it("destroys cached instances on evictTranslators", async () => {
    const detector = fakeDetectorApi(ENGLISH);
    const translator = fakeTranslatorApi();
    await translateSelection("hello", { detectorApi: detector.api, translatorApi: translator.api });
    evictTranslators();
    await vi.waitFor(() => expect(translator.instance.destroy).toHaveBeenCalled());
    expect(detector.instance.destroy).toHaveBeenCalled();
  });

  it("destroys cached instances after the idle timeout", async () => {
    vi.useFakeTimers();
    try {
      const detector = fakeDetectorApi(ENGLISH);
      const translator = fakeTranslatorApi();
      await translateSelection("hello", { detectorApi: detector.api, translatorApi: translator.api });
      await vi.advanceTimersByTimeAsync(TRANSLATOR_IDLE_TIMEOUT_MS);
      expect(translator.instance.destroy).toHaveBeenCalled();
      expect(detector.instance.destroy).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns error when aborted mid-flight and keeps the shared cache alive", async () => {
    const detector = fakeDetectorApi(ENGLISH);
    const translator = fakeTranslatorApi();
    const controller = new AbortController();
    translator.instance.translate.mockImplementation(async () => {
      controller.abort();
      return "xin chào";
    });
    const options = { detectorApi: detector.api, translatorApi: translator.api };
    expect(await translateSelection("hello", { ...options, signal: controller.signal })).toEqual({ kind: "error" });
    expect(translator.instance.destroy).not.toHaveBeenCalled();
    expect(detector.instance.destroy).not.toHaveBeenCalled();

    translator.instance.translate.mockResolvedValue("ổn");
    expect(await translateSelection("hello", options)).toMatchObject({ kind: "translated", text: "ổn" });
    expect(translator.api.create).toHaveBeenCalledTimes(2);
  });

  it("lets a concurrent call for the same direction succeed when the other is aborted", async () => {
    const detector = fakeDetectorApi(ENGLISH);
    const translator = fakeTranslatorApi();
    const controller = new AbortController();
    const options = { detectorApi: detector.api, translatorApi: translator.api };
    const aborted = translateSelection("hello", { ...options, signal: controller.signal });
    const surviving = translateSelection("world", options);
    controller.abort();
    expect(await aborted).toEqual({ kind: "error" });
    expect(await surviving).toMatchObject({ kind: "translated", text: "Bộ trưởng..." });
    expect(translator.api.create).toHaveBeenCalledTimes(2);
  });

  describe("transient user activation", () => {
    const ACTIVATION_WINDOW_MS = 5000;

    it("starts every create in the click turn so a slow detector download cannot expire the translator's activation", async () => {
      vi.useFakeTimers();
      try {
        const clickedAt = Date.now();
        let detectorFinished = false;
        const detectorInstance = { detect: vi.fn().mockResolvedValue(ENGLISH), destroy: vi.fn() };
        const detectorApi = {
          availability: vi.fn().mockResolvedValue("downloadable"),
          create: vi.fn(
            () =>
              new Promise<typeof detectorInstance>((resolve) =>
                setTimeout(() => {
                  detectorFinished = true;
                  resolve(detectorInstance);
                }, ACTIVATION_WINDOW_MS + 1000),
              ),
          ),
        } satisfies LanguageDetectorApi;
        const translatorInstance = { translate: vi.fn().mockResolvedValue("xin chào"), destroy: vi.fn() };
        const translatorApi = {
          availability: vi.fn().mockResolvedValue("downloadable"),
          create: vi.fn(async () => {
            if (detectorFinished || Date.now() - clickedAt > ACTIVATION_WINDOW_MS) {
              throw new DOMException("activation expired", "NotAllowedError");
            }
            return translatorInstance;
          }),
        } satisfies TranslatorApi;

        const pending = translateSelection("hello", { detectorApi, translatorApi });
        await vi.advanceTimersByTimeAsync(ACTIVATION_WINDOW_MS + 1000);

        expect(await pending).toMatchObject({ kind: "translated", text: "xin chào" });
        expect(translatorApi.create).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it("returns unavailable when only the opposite direction was started", async () => {
      const detector = fakeDetectorApi([{ detectedLanguage: "vi", confidence: 0.9 }]);
      const translator = fakeTranslatorApi();
      translator.api.availability.mockImplementation(async ({ sourceLanguage }: { sourceLanguage: string }) =>
        sourceLanguage === "en" ? "available" : "unavailable",
      );
      const outcome = await translateSelection("xin chào", {
        detectorApi: detector.api,
        translatorApi: translator.api,
      });
      expect(outcome).toEqual({ kind: "unavailable" });
    });

    it("does not turn a failed unused-direction create into an error", async () => {
      const detector = fakeDetectorApi(ENGLISH);
      const translator = fakeTranslatorApi();
      translator.api.create
        .mockResolvedValueOnce(translator.instance)
        .mockRejectedValueOnce(new DOMException("activation", "NotAllowedError"));
      const outcome = await translateSelection("hello", { detectorApi: detector.api, translatorApi: translator.api });
      expect(outcome).toMatchObject({ kind: "translated" });
    });
  });

  describe("combined progress and phase", () => {
    type ProgressListener = (event: { loaded: number }) => void;

    function listenerFor(options: Record<string, unknown>): ProgressListener {
      let listener!: ProgressListener;
      (options.monitor as (monitor: unknown) => void)({
        addEventListener: (_type: string, registered: ProgressListener) => (listener = registered),
      });
      return listener;
    }

    it("reports one combined, non-decreasing percent that ends at 100, ignoring the unused direction", async () => {
      let resolveDetector!: (instance: unknown) => void;
      const detectorListeners: ProgressListener[] = [];
      const detectorInstance = { detect: vi.fn().mockResolvedValue(ENGLISH), destroy: vi.fn() };
      const detectorApi = {
        availability: vi.fn().mockResolvedValue("downloadable"),
        create: vi.fn((options: Record<string, unknown>) => {
          detectorListeners.push(listenerFor(options));
          return new Promise((resolve) => (resolveDetector = resolve));
        }),
      } as unknown as LanguageDetectorApi;
      const translatorListeners: Record<string, ProgressListener> = {};
      let resolveEnglishToVietnamese!: (instance: unknown) => void;
      const translatorInstance = { translate: vi.fn().mockResolvedValue("xin chào"), destroy: vi.fn() };
      const translatorApi = {
        availability: vi.fn().mockResolvedValue("downloadable"),
        create: vi.fn((options: Record<string, unknown>) => {
          translatorListeners[options.sourceLanguage as string] = listenerFor(options);
          return new Promise((resolve) => {
            if (options.sourceLanguage === "en") {
              resolveEnglishToVietnamese = resolve;
            }
          });
        }),
      } as unknown as TranslatorApi;
      const onProgress = vi.fn();
      const pending = translateSelection("hello", { detectorApi, translatorApi, onProgress });
      await vi.waitFor(() => expect(translatorApi.create).toHaveBeenCalledTimes(2));

      detectorListeners[0]!({ loaded: 0.5 });
      translatorListeners.en!({ loaded: 0.2 });
      translatorListeners.vi!({ loaded: 0.1 });
      detectorListeners[0]!({ loaded: 1 });
      resolveDetector(detectorInstance);
      await vi.waitFor(() => expect(detectorInstance.detect).toHaveBeenCalled());
      await Promise.resolve();
      translatorListeners.vi!({ loaded: 0.9 });
      translatorListeners.en!({ loaded: 1 });
      resolveEnglishToVietnamese(translatorInstance);
      expect(await pending).toMatchObject({ kind: "translated" });

      const percents = onProgress.mock.calls.map(([percent]) => percent as number);
      expect(percents.length).toBeGreaterThan(0);
      expect([...percents].sort((a, b) => a - b)).toEqual(percents);
      expect(percents.at(-1)).toBe(100);
    });

    it("signals the translating phase after the translator is ready and before translating", async () => {
      const detector = fakeDetectorApi(ENGLISH);
      const translator = fakeTranslatorApi();
      const events: string[] = [];
      translator.instance.translate.mockImplementation(async () => {
        events.push("translate");
        return "xin chào";
      });
      await translateSelection("hello", {
        detectorApi: detector.api,
        translatorApi: translator.api,
        onPhase: (phase) => events.push(phase),
      });
      expect(events).toEqual(["translating", "translate"]);
    });
  });

  describe("after the outcome is returned", () => {
    type ProgressListener = (event: { loaded: number }) => void;

    function downloadingTranslatorApi() {
      const listeners: ProgressListener[] = [];
      const api = {
        availability: vi.fn().mockResolvedValue("downloadable"),
        create: vi.fn((options: Record<string, unknown>) => {
          (options.monitor as (monitor: unknown) => void)?.({
            addEventListener: (_type: string, listener: ProgressListener) => listeners.push(listener),
          });
          return new Promise<never>(() => undefined);
        }),
      } as unknown as TranslatorApi;
      return { api, listeners };
    }

    async function settleWith(detections: LanguageDetectionResult[] | Error) {
      const detectorInstance = {
        detect: vi.fn(() => (detections instanceof Error ? Promise.reject(detections) : Promise.resolve(detections))),
        destroy: vi.fn(),
      };
      const detectorApi = {
        availability: vi.fn().mockResolvedValue("available"),
        create: vi.fn().mockResolvedValue(detectorInstance),
      } as unknown as LanguageDetectorApi;
      const translator = downloadingTranslatorApi();
      const onProgress = vi.fn();
      const onPhase = vi.fn();
      const outcome = await translateSelection("text", {
        detectorApi,
        translatorApi: translator.api,
        onProgress,
        onPhase,
      });
      const callsAtOutcome = onProgress.mock.calls.length;
      translator.listeners.forEach((listener) => listener({ loaded: 0.6 }));
      return { outcome, onProgress, callsAtOutcome, onPhase };
    }

    it("emits no progress after unsupported-language", async () => {
      const { outcome, onProgress, callsAtOutcome } = await settleWith([{ detectedLanguage: "ja", confidence: 0.99 }]);
      expect(outcome).toEqual({ kind: "unsupported-language" });
      expect(onProgress).toHaveBeenCalledTimes(callsAtOutcome);
    });
  });
});
