import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  manifest: {
    name: "Promptizer",
    description: "Preview a clearer version of the current prompt before replacing it.",
    minimum_chrome_version: "138",
    permissions: ["storage", "activeTab"],
    host_permissions: ["http://127.0.0.1:8765/*"],
    commands: {
      "refine-prompt": {
        suggested_key: {
          default: "Ctrl+Shift+Y",
          mac: "Command+Shift+Y"
        },
        description: "Refine the active prompt"
      }
    }
  }
});
