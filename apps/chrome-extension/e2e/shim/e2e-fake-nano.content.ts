// E2E-only shim, only matches the local fixture origin, never a real site.
// Content scripts from the same extension share one isolated world per frame, so this
// runs before src/entrypoints/content.ts and makes globalThis.LanguageModel visible to it
// without touching the page's own (inaccessible, cross-world) globals.
export default defineContentScript({
  matches: ["http://127.0.0.1:4173/*"],
  runAt: "document_start",
  main() {
    function respond(sys: string, inputJson: string): string {
      const { current_prompt } = JSON.parse(inputJson) as { current_prompt: string };
      let refined = current_prompt.trim();
      if (sys.includes("Shorten")) {
        const words = refined.split(/\s+/);
        refined = words.slice(0, Math.max(3, Math.ceil(words.length / 2))).join(" ");
      } else if (sys.includes("Fix the grammar")) {
        refined = refined.charAt(0).toUpperCase() + refined.slice(1) + (refined.endsWith(".") ? "" : ".");
      } else if (sys.includes("Vietnamese")) {
        refined = "Ban tieng Viet: " + refined;
      } else if (sys.includes("professional tone")) {
        refined = "Please note, " + refined;
      } else {
        refined = "Refined: " + refined;
      }
      return JSON.stringify({ decision: "refine", refined_prompt: refined });
    }

    const SLOW_MARKER = "slow";
    const SLOW_RESPONSE_MS = 1500;

    async function respondAfterDelay(sys: string, inputJson: string): Promise<string> {
      if (inputJson.includes(SLOW_MARKER)) {
        await new Promise((resolve) => setTimeout(resolve, SLOW_RESPONSE_MS));
      }
      return respond(sys, inputJson);
    }

    (globalThis as Record<string, unknown>).LanguageModel = {
      availability: async () => "available",
      create: async (options: { initialPrompts?: { content?: string }[] }) => {
        const sys = options?.initialPrompts?.[0]?.content ?? "";
        return {
          prompt: (input: string) => respondAfterDelay(sys, input),
          clone: async () => ({ prompt: (input: string) => respondAfterDelay(sys, input), destroy: () => {} }),
          destroy: () => {},
        };
      },
    };
  },
});
