const LOOPBACK_URL = "http://127.0.0.1:8765/v1/refine";
const REQUEST_TIMEOUT_MS = 6500;

interface GroqRefineMessage {
  type: "PROMPTIZER_GROQ_REFINE";
  prompt: string;
}

interface GroqRefineResponse {
  ok: boolean;
  decision?: "keep" | "refine";
  refinedPrompt?: string;
  reason?: "not-configured";
}

export function isGroqRefineMessage(message: unknown): message is GroqRefineMessage {
  return (
    typeof message === "object" && message !== null && (message as { type?: unknown }).type === "PROMPTIZER_GROQ_REFINE"
  );
}

export async function handleGroqRefine(prompt: string): Promise<GroqRefineResponse> {
  const stored = await browser.storage.local.get("pairingToken");
  const pairingToken = typeof stored.pairingToken === "string" ? stored.pairingToken : "";
  if (pairingToken === "") {
    return { ok: false, reason: "not-configured" };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(LOOPBACK_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${pairingToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ request_id: crypto.randomUUID(), prompt, source: "browser" }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      return { ok: false };
    }
    const data = (await response.json()) as { decision?: string; refined_prompt?: string };
    if (data.decision !== "keep" && data.decision !== "refine") {
      return { ok: false };
    }
    return { ok: true, decision: data.decision, refinedPrompt: data.refined_prompt };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timeout);
  }
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isGroqRefineMessage(message)) {
      return false;
    }
    handleGroqRefine(message.prompt).then(sendResponse);
    return true;
  });
});
