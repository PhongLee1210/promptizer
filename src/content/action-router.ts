import { refineViaGroqLoopback } from "./groq-bridge";
import { refineWithNano } from "./nano";
import type { ActionId, RefineResult } from "./action-types";

export interface ActionRouterDependencies {
  refineWithNano: typeof refineWithNano;
  refineViaGroqLoopback: typeof refineViaGroqLoopback;
}

const defaultDependencies: ActionRouterDependencies = {
  refineWithNano,
  refineViaGroqLoopback,
};

export function performAction(
  dependencies: ActionRouterDependencies = defaultDependencies,
): (action: ActionId, text: string) => Promise<RefineResult> {
  return async (action, text) => {
    const nanoResult = await dependencies.refineWithNano(action, text);
    if (nanoResult.decision !== "error") {
      return nanoResult;
    }
    if (action !== "refine") {
      return nanoResult;
    }
    return dependencies.refineViaGroqLoopback(text);
  };
}

export const performActionWithRealProviders = performAction();
