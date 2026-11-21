import { browser } from "wxt/browser";
import { el, iconEl } from "../dom";
import { banner, button, headerSub, screenShell, setButtonBusy, statusPill } from "../components";
import { nanoStatusLabel, type NanoState } from "../state-types";
import type { Dispatch } from "../types";

interface SetupStep {
  title: string;
  detail: string;
  copyValue?: string;
  shot?: { src: ShotPath; alt: string };
}

type ShotPath =
  "/guide/step-version.png" | "/guide/step-find-flag.png" | "/guide/step-enable-flag.png" | "/guide/step-relaunch.png";

const ABOUT_PAGE = "chrome://settings/help";
const PROMPT_API_FLAG = "chrome://flags/#prompt-api";
const COMPONENTS_PAGE = "chrome://components";

const SETUP_STEPS: SetupStep[] = [
  {
    title: "Check your Chrome version",
    detail: "Built-in AI needs Chrome 138 or newer. The version sits under the update status.",
    copyValue: ABOUT_PAGE,
    shot: {
      src: "/guide/step-version.png",
      alt: "The About Chrome page showing the version number under Google Chrome",
    },
  },
  {
    title: "Find the Prompt API flag",
    detail:
      'Paste this address, then search for "prompt-api". On Chrome 138 to 156 the flag is named prompt-api-for-gemini-nano instead.',
    copyValue: PROMPT_API_FLAG,
    shot: {
      src: "/guide/step-find-flag.png",
      alt: 'The flags page filtered to "prompt-api", with the Prompt API row showing',
    },
  },
  {
    title: "Switch the dropdown to Enabled",
    detail: "The row turns blue once it is no longer on Default.",
    shot: { src: "/guide/step-enable-flag.png", alt: "The Prompt API flag row with its dropdown set to Enabled" },
  },
  {
    title: "Relaunch Chrome",
    detail: "The flag only takes effect after the restart. Chrome reopens your tabs.",
    shot: { src: "/guide/step-relaunch.png", alt: "The relaunch bar at the bottom of the flags page" },
  },
  {
    title: "Download the model",
    detail:
      "Press Download model below and leave Chrome open. Gemini Nano needs several gigabytes of free disk space and an unmetered connection.",
  },
  {
    title: "Still stuck? Check the component",
    detail: 'Paste this address and look for "Optimization Guide On Device Model" with a version other than 0.0.0.0.',
    copyValue: COMPONENTS_PAGE,
  },
];

let stepsOpenChoice: boolean | undefined;

function copyAction(value: string, dispatch: Dispatch): HTMLElement {
  return button({
    label: "Copy",
    variant: "text",
    iconName: "copy",
    compact: true,
    onClick: () => {
      void navigator.clipboard
        ?.writeText(value)
        .then(() => dispatch.announce(`${value} copied`))
        .catch(() => dispatch.announce("Copy failed. Select the address and copy it by hand."));
    },
  });
}

function stepRow(step: SetupStep, index: number, dispatch: Dispatch): HTMLElement {
  const body: (Node | string)[] = [
    el("p", { class: "pz-body-strong" }, [step.title]),
    el("p", { class: "pz-caption pz-text-muted" }, [step.detail]),
  ];
  if (step.copyValue !== undefined) {
    body.push(
      el("div", { class: "pz-step__address" }, [
        el("code", { class: "pz-step__code pz-caption" }, [step.copyValue]),
        copyAction(step.copyValue, dispatch),
      ]),
    );
  }
  if (step.shot !== undefined) {
    body.push(
      el("img", {
        class: "pz-step__shot",
        src: browser.runtime.getURL(step.shot.src),
        alt: step.shot.alt,
        loading: "lazy",
      }),
    );
  }
  return el("li", { class: "pz-step" }, [
    el("span", { class: "pz-step__num pz-caption" }, [String(index + 1)]),
    el("div", { class: "pz-step__body" }, body),
  ]);
}

function cardActions(dispatch: Dispatch, nano: NanoState): HTMLElement {
  const checkAgain = button({
    label: "Check again",
    variant: "text",
    onClick: () => void dispatch.refreshNano(),
  });
  if (nano.status === "ready") {
    return el("div", { class: "pz-row-actions" }, [checkAgain]);
  }
  const download = button({ label: "Download model", onClick: () => void dispatch.startNanoDownload() });
  if (nano.status === "downloading") {
    setButtonBusy(download, true);
    return el("div", { class: "pz-row-actions" }, [download]);
  }
  return el("div", { class: "pz-row-actions" }, [checkAgain, download]);
}

function progressRow(nano: NanoState): HTMLElement {
  const isDownloading = nano.status === "downloading";
  return el(
    "div",
    {
      class: "pz-nano-progress",
      "data-active": isDownloading ? "" : undefined,
      "aria-hidden": isDownloading ? undefined : "true",
    },
    [
      el("div", { class: "pz-progress-track" }, [
        el("div", { class: "pz-progress-fill", style: `width: ${nano.percent}%` }),
      ]),
      el("span", { class: "pz-caption pz-text-muted pz-num" }, [`${nano.percent}%`]),
    ],
  );
}

function statusCard(dispatch: Dispatch, nano: NanoState): HTMLElement {
  const children: (Node | string)[] = [
    el("div", { class: "pz-card__head" }, [
      el("p", { class: "pz-overline pz-text-muted" }, ["On-device AI"]),
      statusPill(nanoStatusLabel(nano), nano.status === "ready" ? "ready" : "standing-by"),
    ]),
    el("div", { class: "pz-model-card__row" }, [
      iconEl("sparkle", 18),
      el("span", { class: "pz-body" }, ["Gemini Nano"]),
    ]),
  ];
  if (nano.status !== "ready") {
    children.push(progressRow(nano));
  }
  children.push(cardActions(dispatch, nano));
  return el("div", { class: "pz-card", role: "status" }, children);
}

function stepsFold(dispatch: Dispatch, nano: NanoState): HTMLElement {
  const fold = el("details", { class: "pz-steps-fold" }, [
    el("summary", { class: "pz-control" }, [
      el("span", { class: "pz-overline pz-text-muted" }, ["Setup steps · once per computer"]),
      iconEl("chevron-down", 16),
    ]),
    el(
      "ol",
      { class: "pz-steps" },
      SETUP_STEPS.map((step, index) => stepRow(step, index, dispatch)),
    ),
  ]);
  fold.open = stepsOpenChoice ?? nano.status !== "ready";
  fold.addEventListener("toggle", () => {
    stepsOpenChoice = fold.open;
  });
  return fold;
}

export function renderNanoSetupScreen(dispatch: Dispatch): HTMLElement {
  const nano = dispatch.getState().nano;

  const body: (Node | string)[] = [statusCard(dispatch, nano)];

  if (nano.status === "unsupported") {
    body.push(
      banner({
        kind: "warning",
        text: "Chrome reports no on-device model here. Work through the steps, or add a cloud backup model.",
        action: button({ label: "Models", variant: "text", compact: true, onClick: () => dispatch.goTo("models") }),
      }),
    );
  }

  body.push(
    stepsFold(dispatch, nano),
    el("p", { class: "pz-footer-note pz-micro" }, ["Chrome blocks links to its own settings, so copy and paste."]),
  );

  return screenShell(
    headerSub({
      title: "On-device AI",
    }),
    body,
  );
}
