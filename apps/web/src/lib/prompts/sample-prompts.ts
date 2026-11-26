import type { PromptSummary } from "./prompts";

const SAMPLE_PROMPTS: PromptSummary[] = [
  {
    id: "mentoring-junior-engineers",
    title: "Mentoring Junior Engineers on Pipeline Architecture",
    body: "Please re-explain the content as if you were a senior engineer mentoring a junior engineer. Keep the explanation short, clear and conversational. Focus on helping a junior quickly understand the overall flow, including how the pipeline works, how the process moves from one step to another, the key topics involved and the technologies used.\n\nUse simple language, avoid unnecessary jargon and include practical examples where they help clarify the concepts.",
    source: "ChatGPT",
    category: "System architecture",
    tags: ["business-coaching", "engineering", "it", "technical-reviews"],
    updatedAt: new Date("2026-11-20"),
  },
  {
    id: "code-review-checklist",
    title: "Code Review Checklist for Quality and Maintainability",
    body: "Please carefully review the code changes against the checklist below and verify that each item has been implemented correctly. Focus on code quality, consistency, readability, maintainability and long-term scalability.\n\nAvoid magic strings, magic numbers and other hardcoded values. Common values such as statuses, field names, configuration keys, event names, routes or identifiers should be defined as constants, enums or shared types.",
    source: "ChatGPT",
    category: "Technical reviews",
    tags: ["best-practices", "code-review", "engineering", "technical-reviews"],
    updatedAt: new Date("2026-11-18"),
  },
  {
    id: "step-by-step-implementation",
    title: "Step-by-Step Software Implementation with Best Practices",
    body: "Execute this task step by step, completing and validating each step before moving to the next while following software engineering best practices: avoid magic values, use clear domain-specific naming, minimize duplication and keep error handling simple and consistent.\n\nDuring each implementation step, document the decisions, the changes made and any notable considerations.",
    source: "Claude",
    category: "Implementation",
    tags: ["best-practices", "engineering"],
    updatedAt: new Date("2026-11-15"),
  },
  {
    id: "product-feature-documentation",
    title: "Create Product Feature Documentation",
    body: "Create a documentation page that explains a feature, requirement, business rule, configuration or workflow in a way that is easy for product managers, business stakeholders, QA and customer-facing teams to understand.\n\nThe document should focus on the problem being solved, who it affects and how it behaves in edge cases.",
    source: "Claude",
    category: "Documentation",
    tags: ["documentation", "product"],
    updatedAt: new Date("2026-11-12"),
  },
  {
    id: "data-analysis-summary",
    title: "Summarize a Dataset and Surface Anomalies",
    body: "Review the dataset below and summarize its structure, the most important trends and any anomalies. State your assumptions and list the follow-up questions that would change the conclusions.",
    source: "Gemini",
    category: "Data analysis",
    tags: ["analytics", "reporting"],
    updatedAt: new Date("2026-11-09"),
  },
  {
    id: "debugging-hypotheses",
    title: "Debug a Failing Test with Ranked Hypotheses",
    body: "Given the failing test output and the relevant code, list the three most likely causes ranked by probability. For each, name the single check that would confirm or rule it out before proposing a fix.",
    source: "ChatGPT",
    category: "Debugging",
    tags: ["debugging", "engineering"],
    updatedAt: new Date("2026-11-05"),
  },
  {
    id: "incident-communication",
    title: "Write a Clear Incident Update",
    body: "Write a short incident update for non-technical stakeholders. Include what happened, who is affected, what we are doing now and when the next update will be sent. Keep the tone calm and factual.",
    source: "Claude",
    category: "Incident communication",
    tags: ["communication", "it"],
    updatedAt: new Date("2026-10-30"),
  },
];

export async function listPrompts(): Promise<PromptSummary[]> {
  return SAMPLE_PROMPTS;
}
