import { browser } from "wxt/browser";
import { el, iconEl } from "../dom";
import { banner, button, headerSub, screenShell, sectionHeading, statusPill } from "../components";
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

function copyAction(value: string, dispatch: Dispatch): HTMLElement {
  return button({
    label: "Copy",
    variant: "text",
    iconName: "copy",
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

function statusCard(nano: NanoState): HTMLElement {
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
  if (nano.status === "downloading") {
    children.push(
      el("div", { class: "pz-progress-track" }, [
        el("div", { class: "pz-progress-fill", style: `width: ${nano.percent}%` }),
      ]),
      el("p", { class: "pz-caption pz-text-muted" }, ["Keep Chrome open until this finishes."]),
    );
  }
  return el("div", { class: "pz-card", role: "status" }, children);
}

function primaryAction(dispatch: Dispatch, nano: NanoState): HTMLElement {
  if (nano.status === "downloading") {
    return button({ label: "Downloading…", disabled: true });
  }
  if (nano.status === "ready") {
    return button({ label: "Check again", variant: "outline", onClick: () => void dispatch.refreshNano() });
  }
  return button({ label: "Download model", onClick: () => void dispatch.startNanoDownload() });
}

export function renderNanoSetupScreen(dispatch: Dispatch): HTMLElement {
  const nano = dispatch.getState().nano;

  const body: (Node | string)[] = [statusCard(nano)];

  if (nano.status === "unsupported") {
    body.push(
      banner({
        kind: "warning",
        text: "Chrome reports no on-device model here. Work through the steps, or add a cloud backup model.",
        action: button({ label: "Models", variant: "text", onClick: () => dispatch.goTo("models") }),
      }),
    );
  }

  body.push(
    sectionHeading("Setup steps", "Once per computer."),
    el(
      "ol",
      { class: "pz-steps" },
      SETUP_STEPS.map((step, index) => stepRow(step, index, dispatch)),
    ),
    primaryAction(dispatch, nano),
  );

  if (nano.status !== "downloading" && nano.status !== "ready") {
    body.push(button({ label: "Check again", variant: "text", onClick: () => void dispatch.refreshNano() }));
  }

  body.push(
    el("p", { class: "pz-footer-note pz-micro" }, ["Chrome blocks links to its own settings, so copy and paste."]),
  );

  return screenShell(
    headerSub({
      title: "On-device AI",
      drawerOpen: dispatch.isDrawerOpen(),
      onMenuClick: () => dispatch.openDrawer(),
    }),
    body,
  );
}
