export type SupportedLanguage = "en" | "vi";
export type TranslatorAvailability = "available" | "downloadable" | "downloading" | "unavailable";

export interface TranslationDirection {
  readonly source: SupportedLanguage;
  readonly target: SupportedLanguage;
}

export interface LanguageDetectionResult {
  readonly detectedLanguage: string;
  readonly confidence: number;
}

export interface LanguageDetectorInstance {
  detect(text: string): Promise<LanguageDetectionResult[]>;
  destroy?(): void;
}

export interface TranslatorInstance {
  translate(text: string): Promise<string>;
  destroy?(): void;
}

export interface LanguageDetectorApi {
  availability(): Promise<TranslatorAvailability>;
  create(options: Record<string, unknown>): Promise<LanguageDetectorInstance>;
}

export interface TranslatorApi {
  availability(options: { sourceLanguage: string; targetLanguage: string }): Promise<TranslatorAvailability>;
  create(options: Record<string, unknown>): Promise<TranslatorInstance>;
}

export type TranslatePhase = "detecting" | "translating";

export interface TranslateOptions {
  translatorApi?: TranslatorApi;
  detectorApi?: LanguageDetectorApi;
  onProgress?: (percent: number) => void;
  onPhase?: (phase: TranslatePhase) => void;
  signal?: AbortSignal;
}

export type TranslateOutcome =
  | { kind: "translated"; direction: TranslationDirection; text: string }
  | { kind: "unsupported-language" }
  | { kind: "unavailable" }
  | { kind: "error" };

export const MAX_SELECTION_LENGTH = 1500;
export const MIN_DETECTION_CONFIDENCE = 0.5;
export const TRANSLATOR_IDLE_TIMEOUT_MS = 180_000;

const DETECTOR_CACHE_KEY = "detector";

const OPPOSITE_LANGUAGE: Readonly<Record<string, SupportedLanguage>> = { en: "vi", vi: "en" };

interface CachedInstance {
  instance: Promise<{ destroy?(): void }>;
  idleHandle: ReturnType<typeof setTimeout> | undefined;
}

const cachedInstances = new Map<string, CachedInstance>();

function primarySubtag(languageTag: string): string {
  return languageTag.toLowerCase().split("-")[0] ?? "";
}

export function directionFrom(results: readonly LanguageDetectionResult[]): TranslationDirection | null {
  const best = results.reduce<LanguageDetectionResult | null>(
    (leader, candidate) => (leader === null || candidate.confidence > leader.confidence ? candidate : leader),
    null,
  );
  if (best === null || best.confidence < MIN_DETECTION_CONFIDENCE) {
    return null;
  }
  const source = primarySubtag(best.detectedLanguage);
  const target = OPPOSITE_LANGUAGE[source];
  return target === undefined ? null : { source: source as SupportedLanguage, target };
}

function forgetInstance(key: string): CachedInstance | undefined {
  const cached = cachedInstances.get(key);
  if (cached === undefined) {
    return undefined;
  }
  cachedInstances.delete(key);
  if (cached.idleHandle !== undefined) {
    clearTimeout(cached.idleHandle);
  }
  return cached;
}

function evictInstance(key: string, entry?: CachedInstance): void {
  if (entry !== undefined && cachedInstances.get(key) !== entry) {
    return;
  }
  forgetInstance(key)
    ?.instance.then((instance) => instance.destroy?.())
    .catch(() => undefined);
}

function refreshIdleTimer(key: string, entry?: CachedInstance): void {
  const cached = cachedInstances.get(key);
  if (cached === undefined || (entry !== undefined && cached !== entry)) {
    return;
  }
  if (cached.idleHandle !== undefined) {
    clearTimeout(cached.idleHandle);
  }
  cached.idleHandle = setTimeout(() => evictInstance(key, cached), TRANSLATOR_IDLE_TIMEOUT_MS);
}

async function cachedInstanceFor<Instance extends { destroy?(): void }>(
  key: string,
  createInstance: () => Promise<Instance>,
): Promise<Instance> {
  let cached = cachedInstances.get(key);
  if (cached === undefined) {
    cached = { instance: createInstance(), idleHandle: undefined };
    cachedInstances.set(key, cached);
  }
  try {
    const instance = (await cached.instance) as Instance;
    refreshIdleTimer(key, cached);
    return instance;
  } catch (error) {
    evictInstance(key, cached);
    throw error;
  }
}

export function evictTranslators(): void {
  for (const key of [...cachedInstances.keys()]) {
    evictInstance(key);
  }
}

function getTranslator(candidate?: TranslatorApi): TranslatorApi | null {
  if (candidate !== undefined) {
    return candidate;
  }
  return (globalThis as { Translator?: TranslatorApi }).Translator ?? null;
}

function getLanguageDetector(candidate?: LanguageDetectorApi): LanguageDetectorApi | null {
  if (candidate !== undefined) {
    return candidate;
  }
  return (globalThis as { LanguageDetector?: LanguageDetectorApi }).LanguageDetector ?? null;
}

interface DownloadMonitor {
  addEventListener(type: "downloadprogress", listener: (event: { loaded: number }) => void): void;
}

function toPercent(loaded: number): number {
  const ratio = loaded > 1 ? loaded / 100 : loaded;
  return Math.min(100, Math.max(0, Math.round(ratio * 100)));
}

class CombinedProgress {
  private readonly percentByKey = new Map<string, number>();
  private readonly ignoredKeys = new Set<string>();
  private lastReported = -1;
  private closed = false;

  constructor(private readonly onProgress: ((percent: number) => void) | undefined) {}

  monitorFor(key: string): Record<string, unknown> {
    if (this.onProgress === undefined) {
      return {};
    }
    return {
      monitor: (monitor: DownloadMonitor) => {
        monitor.addEventListener("downloadprogress", (event) => this.record(key, toPercent(event.loaded)));
      },
    };
  }

  close(): void {
    this.closed = true;
  }

  ignore(key: string): void {
    this.ignoredKeys.add(key);
    this.percentByKey.delete(key);
  }

  private record(key: string, percent: number): void {
    if (this.closed || this.ignoredKeys.has(key)) {
      return;
    }
    this.percentByKey.set(key, percent);
    const percents = [...this.percentByKey.values()];
    const combined = Math.round(percents.reduce((sum, value) => sum + value, 0) / percents.length);
    if (combined > this.lastReported) {
      this.lastReported = combined;
      this.onProgress?.(combined);
    }
  }
}

function translatorKeyFor(direction: TranslationDirection): string {
  return `${direction.source}-${direction.target}`;
}

function languagePairFor(direction: TranslationDirection): { sourceLanguage: string; targetLanguage: string } {
  return { sourceLanguage: direction.source, targetLanguage: direction.target };
}

const TRANSLATION_DIRECTIONS: readonly TranslationDirection[] = [
  { source: "en", target: "vi" },
  { source: "vi", target: "en" },
];

export async function translateSelection(text: string, options: TranslateOptions = {}): Promise<TranslateOutcome> {
  const detectorApi = getLanguageDetector(options.detectorApi);
  const translatorApi = getTranslator(options.translatorApi);
  if (detectorApi === null || translatorApi === null) {
    return { kind: "unavailable" };
  }
  const { onPhase, signal } = options;
  const progress = new CombinedProgress(options.onProgress);
  const wasAborted = () => signal?.aborted === true;
  if (wasAborted()) {
    return { kind: "error" };
  }
  try {
    const [detectorAvailability, ...translatorAvailabilities] = await Promise.all([
      detectorApi.availability(),
      ...TRANSLATION_DIRECTIONS.map((direction) => translatorApi.availability(languagePairFor(direction))),
    ]);
    if (detectorAvailability === "unavailable" || wasAborted()) {
      return { kind: detectorAvailability === "unavailable" ? "unavailable" : "error" };
    }
    const detectorPending = cachedInstanceFor(DETECTOR_CACHE_KEY, () =>
      detectorApi.create(progress.monitorFor(DETECTOR_CACHE_KEY)),
    );
    const startedTranslators = new Map<string, Promise<TranslatorInstance>>();
    TRANSLATION_DIRECTIONS.forEach((direction, index) => {
      if (translatorAvailabilities[index] === "unavailable") {
        return;
      }
      const key = translatorKeyFor(direction);
      const pending = cachedInstanceFor(key, () =>
        translatorApi.create({ ...languagePairFor(direction), ...progress.monitorFor(key) }),
      );
      pending.catch(() => undefined);
      startedTranslators.set(key, pending);
    });
    const detector = await detectorPending;
    if (wasAborted()) {
      return { kind: "error" };
    }
    const detections = await detector.detect(text);
    refreshIdleTimer(DETECTOR_CACHE_KEY);
    if (wasAborted()) {
      return { kind: "error" };
    }
    const direction = directionFrom(detections);
    if (direction === null) {
      return { kind: "unsupported-language" };
    }
    const translatorKey = translatorKeyFor(direction);
    for (const key of startedTranslators.keys()) {
      if (key !== translatorKey) {
        progress.ignore(key);
      }
    }
    const pendingTranslator = startedTranslators.get(translatorKey);
    if (pendingTranslator === undefined) {
      return { kind: "unavailable" };
    }
    const translator = await pendingTranslator;
    if (wasAborted()) {
      return { kind: "error" };
    }
    onPhase?.("translating");
    const translation = await translator.translate(text);
    refreshIdleTimer(translatorKey);
    if (wasAborted()) {
      return { kind: "error" };
    }
    return { kind: "translated", direction, text: translation };
  } catch {
    return { kind: "error" };
  } finally {
    progress.close();
  }
}
