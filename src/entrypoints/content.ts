import { startChipController } from "../content/controller";

export default defineContentScript({
  matches: ["https://claude.ai/*", "https://chatgpt.com/*"],
  runAt: "document_idle",
  main() {
    if (document.documentElement.hasAttribute("data-promptizer-active")) {
      return;
    }
    document.documentElement.setAttribute("data-promptizer-active", "");
    startChipController();
  },
});
