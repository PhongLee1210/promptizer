export const SLOW_OPERATION_HINT_MS = 6000;
export const SLOW_HINT_TEXT = "Still working. This can take a moment.";
export const MAX_SETTLE_STEPS = 5;

const LOADING_REVEAL_DELAY_MS = 150;
const SHIMMER_STAGGER_MS = 120;
const SHIMMER_SWEEP_MS = 1400;
const SETTLE_STEP_MS = 40;
const SETTLE_OFFSET_PX = 4;
const INDETERMINATE_SLIDE_MS = 1400;
const DOT_CYCLE_MS = 1200;
const DOT_STAGGER_MS = 160;
const DOT_COUNT = 3;
const PERCENT_MAX = 100;

export const LOADING_STYLE = `
  .pz-load {
    animation: pz-load-reveal var(--pz-dur-base) var(--pz-ease-out) ${LOADING_REVEAL_DELAY_MS}ms both;
  }
  @keyframes pz-load-reveal {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .pz-load__lines {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .pz-load__line {
    position: relative;
    height: 8px;
    border-radius: var(--pz-radius-half);
    background: var(--pz-color-fill-skeleton-default);
    overflow: hidden;
  }
  .pz-load__line::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, var(--pz-color-background-base-floating), transparent);
    opacity: 0.7;
    transform: translateX(-100%);
    animation: pz-load-shimmer ${SHIMMER_SWEEP_MS}ms var(--pz-ease-std) infinite;
    animation-delay: calc(var(--pz-load-line-index, 0) * ${SHIMMER_STAGGER_MS}ms);
  }
  @keyframes pz-load-shimmer {
    from { transform: translateX(-100%); }
    60%, to { transform: translateX(100%); }
  }
  .pz-load__label {
    display: inline-flex;
    align-items: baseline;
  }
  .pz-load__dots {
    display: inline-flex;
    margin-left: 1px;
  }
  .pz-load__dots > span::before {
    content: ".";
  }
  .pz-load__dots > span {
    animation: pz-load-dot ${DOT_CYCLE_MS}ms ease-in-out infinite;
    animation-delay: calc(var(--pz-load-dot-index, 0) * ${DOT_STAGGER_MS}ms);
  }
  @keyframes pz-load-dot {
    0%, 70%, 100% { opacity: 0.25; }
    35% { opacity: 1; }
  }
  .pz-load__hint {
    margin: 0;
    font-size: 11px;
    line-height: 15px;
    white-space: nowrap;
    color: var(--pz-color-text-base-subdued);
    animation: pz-load-reveal var(--pz-dur-base) var(--pz-ease-out) both;
  }
  .pz-load__progress {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .pz-load__progress-line {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    font-size: 12px;
  }
  .pz-load__progress-pct {
    font-variant-numeric: tabular-nums;
    color: var(--pz-color-text-brand-strong);
  }
  .pz-load__progress-track {
    height: 4px;
    border-radius: var(--pz-radius-half);
    background: var(--pz-color-fill-track-default);
    overflow: hidden;
  }
  .pz-load__progress-fill {
    width: 100%;
    height: 100%;
    background: var(--pz-color-fill-brand-default);
    transform-origin: left center;
    transform: scaleX(var(--pz-load-progress, 0));
    transition: transform var(--pz-dur-slow) var(--pz-ease-out);
  }
  .pz-load__progress-fill[data-indeterminate="true"] {
    width: 40%;
    transform: none;
    animation: pz-load-slide ${INDETERMINATE_SLIDE_MS}ms ease-in-out infinite;
  }
  @keyframes pz-load-slide {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(250%); }
  }
  .pz-settle {
    animation: pz-settle var(--pz-dur-base) var(--pz-ease-out) both;
    animation-delay: calc(var(--pz-settle-step, 0) * ${SETTLE_STEP_MS}ms);
  }
  @keyframes pz-settle {
    from {
      opacity: 0;
      transform: translateY(${SETTLE_OFFSET_PX}px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .pz-load__line::after,
    .pz-load__progress-fill[data-indeterminate="true"],
    .pz-load__dots > span {
      animation: none;
    }
    .pz-load__line::after {
      display: none;
    }
    .pz-load__dots > span {
      opacity: 0.6;
    }
    .pz-load__progress-fill {
      transition: none;
    }
    .pz-settle {
      animation: pz-load-reveal var(--pz-dur-base) var(--pz-ease-out) both;
    }
  }
`;

export function createShimmerLines(widths: readonly string[]): HTMLDivElement {
  const lines = document.createElement("div");
  lines.className = "pz-load pz-load__lines";
  lines.setAttribute("aria-hidden", "true");
  widths.forEach((width, index) => {
    const line = document.createElement("span");
    line.className = "pz-load__line";
    line.style.width = width;
    line.style.setProperty("--pz-load-line-index", String(index));
    lines.append(line);
  });
  return lines;
}

export function createBusyLabel(verb: string): HTMLSpanElement {
  const label = document.createElement("span");
  label.className = "pz-load__label";
  label.append(verb);
  const dots = document.createElement("span");
  dots.className = "pz-load__dots";
  dots.setAttribute("aria-hidden", "true");
  for (let index = 0; index < DOT_COUNT; index += 1) {
    const dot = document.createElement("span");
    dot.style.setProperty("--pz-load-dot-index", String(index));
    dots.append(dot);
  }
  label.append(dots);
  return label;
}

function clampPercent(percent: number): number {
  if (Number.isNaN(percent)) {
    return 0;
  }
  return Math.min(Math.max(percent, 0), PERCENT_MAX);
}

export function createProgressBar(percent: number, label: string): HTMLDivElement {
  const clamped = clampPercent(percent);
  const isIndeterminate = clamped <= 0;
  const progress = document.createElement("div");
  progress.className = "pz-load__progress";
  progress.setAttribute("role", "progressbar");
  progress.setAttribute("aria-label", label);
  progress.setAttribute("aria-valuemin", "0");
  progress.setAttribute("aria-valuemax", String(PERCENT_MAX));

  const line = document.createElement("div");
  line.className = "pz-load__progress-line";
  const name = document.createElement("span");
  name.textContent = label;
  const value = document.createElement("span");
  value.className = "pz-load__progress-pct";
  line.append(name, value);

  const track = document.createElement("div");
  track.className = "pz-load__progress-track";
  const fill = document.createElement("div");
  fill.className = "pz-load__progress-fill";
  track.append(fill);

  progress.append(line, track);
  if (isIndeterminate) {
    fill.dataset.indeterminate = "true";
  } else {
    applyDeterminateProgress(progress, clamped);
  }
  return progress;
}

function applyDeterminateProgress(progress: HTMLElement, clamped: number): void {
  progress.setAttribute("aria-valuenow", String(clamped));
  const value = progress.querySelector<HTMLElement>(".pz-load__progress-pct");
  const fill = progress.querySelector<HTMLElement>(".pz-load__progress-fill");
  if (value !== null) {
    value.textContent = `${clamped}%`;
  }
  fill?.style.setProperty("--pz-load-progress", String(clamped / PERCENT_MAX));
}

export function updateProgressBar(progress: HTMLElement, percent: number): boolean {
  const clamped = clampPercent(percent);
  const fill = progress.querySelector<HTMLElement>(".pz-load__progress-fill");
  const wasIndeterminate = fill?.dataset.indeterminate === "true";
  if (fill === null || wasIndeterminate || clamped <= 0) {
    return false;
  }
  applyDeterminateProgress(progress, clamped);
  return true;
}

export function createSlowHint(): HTMLParagraphElement {
  const hint = document.createElement("p");
  hint.className = "pz-load__hint";
  hint.textContent = SLOW_HINT_TEXT;
  return hint;
}

export function applySettleIn(element: HTMLElement, step = 0): void {
  element.classList.add("pz-settle");
  element.style.setProperty("--pz-settle-step", String(Math.min(step, MAX_SETTLE_STEPS)));
}

export class SlowHintTimer {
  private handle: ReturnType<typeof setTimeout> | null = null;

  start(onSlow: () => void): void {
    this.cancel();
    this.handle = setTimeout(() => {
      this.handle = null;
      onSlow();
    }, SLOW_OPERATION_HINT_MS);
  }

  cancel(): void {
    if (this.handle !== null) {
      clearTimeout(this.handle);
      this.handle = null;
    }
  }
}
