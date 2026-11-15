export type RefineDecision = "refine" | "keep" | "error";
export type ActionId = "refine" | "translate" | "improve";

export interface RefineResult {
  decision: RefineDecision;
  refinedText?: string;
}
