export type RefineDecision = "refine" | "keep" | "error";
export type ActionId = "refine" | "improve" | "grammar" | "shorten" | "vi" | "en" | "pro" | "friendly" | "direct";
export type RailGroupId = "translate" | "tone";
export type ActionSource = "text" | "result";

export interface RefineResult {
  decision: RefineDecision;
  refinedText?: string;
  reason?: "not-configured";
}
