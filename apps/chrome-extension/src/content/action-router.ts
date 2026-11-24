import { refineWithNano } from "./nano";
import type { ActionId, RefineResult } from "./action-types";

export interface ActionRouterDependencies {
  refineWithNano: typeof refineWithNano;
}

const defaultDependencies: ActionRouterDependencies = {
  refineWithNano,
};

export function performAction(
  dependencies: ActionRouterDependencies = defaultDependencies,
): (action: ActionId, text: string) => Promise<RefineResult> {
  return async (action, text) => dependencies.refineWithNano(action, text);
}

export const performActionWithRealProviders = performAction();
