import { startChipController } from "../src/content/controller";
import type { ActionId, RefineResult } from "../src/content/action-types";

const outcomeSelect = document.querySelector("#outcome") as HTMLSelectElement;
const delaySelect = document.querySelector("#delay") as HTMLSelectElement;
const log = document.querySelector("#log") as HTMLElement;

const SUGGESTION: Record<ActionId, string> = {
  refine: "Create a modern landing page for my coffee shop. Include a menu section with prices.",
  improve:
    "Goal: launch a landing page for a coffee shop.\n" +
    "Audience: local customers looking for a cafe.\n" +
    "Include: hero image, menu with prices, opening hours, directions.",
  grammar: "Make a landing page for my coffee shop, modern, with a menu.",
  shorten: "Coffee shop landing page with a menu.",
  vi: "Tạo trang chủ hiện đại cho quán cà phê của tôi, có menu.",
  en: "Make a modern landing page for my coffee shop, with a menu.",
  pro: "Please create a modern landing page for our coffee shop, including a menu section.",
  friendly: "Hey! Could you whip up a cozy landing page for my coffee shop with a menu? :)",
  direct: "Build a coffee shop landing page. Include the menu.",
};

function answerFor(action: ActionId, text: string): RefineResult {
  switch (outcomeSelect.value) {
    case "keep":
      return { decision: "keep" };
    case "error":
      return { decision: "error" };
    case "same":
      return { decision: "refine", refinedText: text };
    default:
      return { decision: "refine", refinedText: SUGGESTION[action] };
  }
}

startChipController({
  prewarm: () => {},
  releaseWarmSessions: () => {},
  performAction: (action, text) => {
    log.textContent = `${action} · ${text.length} chars`;
    return new Promise((resolve) => {
      window.setTimeout(() => resolve(answerFor(action, text)), Number(delaySelect.value));
    });
  },
});
