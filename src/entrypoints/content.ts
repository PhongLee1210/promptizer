import { startChipController } from "../content/controller";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main() {
    if (document.documentElement.hasAttribute("data-promptizer-active")) {
      return;
    }
    document.documentElement.setAttribute("data-promptizer-active", "");
    startChipController();
  },
});
