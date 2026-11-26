import { createClient } from "@supabase/supabase-js";

const SEED_PROMPTS = [
  {
    title: "Mentoring Junior Engineers on Pipeline Architecture",
    model: "chatgpt",
    category: "System architecture",
    tags: ["engineering", "it", "business-coaching"],
    versions: [
      "Re-explain the content as a senior engineer mentoring a junior. Keep it short and conversational.",
      "Please re-explain the content as if you were a senior engineer mentoring a junior engineer. Keep the explanation short, clear and conversational. Focus on how the pipeline works, how the process moves from one step to another, the key topics involved and the technologies used.\n\nUse simple language, avoid unnecessary jargon and include practical examples where they help.",
    ],
  },
  {
    title: "Code Review Checklist for Quality and Maintainability",
    model: "chatgpt",
    category: "Technical reviews",
    tags: ["code-review", "engineering", "best-practices"],
    versions: [
      "Review the code changes against the checklist below and verify each item was implemented correctly. Focus on quality, consistency, readability, maintainability and scalability.\n\nAvoid magic strings, magic numbers and hardcoded values. Define statuses, field names, configuration keys, event names and routes as constants, enums or shared types.",
    ],
  },
  {
    title: "Step-by-Step Software Implementation with Best Practices",
    model: "claude",
    category: "Implementation",
    tags: ["best-practices", "engineering"],
    versions: [
      "Execute this task step by step, completing and validating each step before moving to the next. Avoid magic values, use clear domain-specific naming, minimize duplication and keep error handling simple and consistent.\n\nDocument the decisions, the changes made and any notable considerations during each step.",
    ],
  },
  {
    title: "Create Product Feature Documentation",
    model: "claude",
    category: "Documentation",
    tags: ["documentation", "product"],
    versions: [
      "Create a documentation page that explains a feature, requirement, business rule or workflow so product managers, QA and customer-facing teams understand it.\n\nFocus on the problem being solved, who it affects and how it behaves in edge cases.",
    ],
  },
  {
    title: "Summarize a Dataset and Surface Anomalies",
    model: "gemini",
    category: "Data analysis",
    tags: ["analytics", "reporting"],
    versions: [
      "Review the dataset below and summarize its structure, the most important trends and any anomalies. State your assumptions and list the follow-up questions that would change the conclusions.",
    ],
  },
  {
    title: "Debug a Failing Test with Ranked Hypotheses",
    model: "chatgpt",
    category: "Debugging",
    tags: ["debugging", "engineering"],
    versions: [
      "Given the failing test output and the relevant code, list the three most likely causes ranked by probability. For each, name the single check that would confirm or rule it out before proposing a fix.",
    ],
  },
  {
    title: "Write a Clear Incident Update",
    model: "claude",
    category: "Incident communication",
    tags: ["communication", "it"],
    versions: [
      "Write a short incident update for non-technical stakeholders. Include what happened, who is affected, what we are doing now and when the next update will be sent. Keep the tone calm and factual.",
    ],
  },
  {
    title: "Turn Meeting Notes into Action Items",
    model: "gemini",
    category: "Productivity",
    tags: ["communication", "product"],
    versions: [
      "Turn the raw meeting notes below into a list of action items. For each item give an owner, a due date if one was mentioned, and the decision it came from. Flag anything that is ambiguous instead of guessing.",
    ],
  },
  {
    title: "Explain a Concept at Three Levels",
    model: null,
    category: null,
    tags: [],
    versions: ["Explain the concept below three times: to a ten-year-old, to a new graduate and to a domain expert."],
  },
];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const email = process.env.SEED_EMAIL ?? process.env.EMAIL;
const reset = process.argv.includes("--reset");

function unwrap({ data, error }) {
  if (error) {
    throw error;
  }
  return data;
}

if (!url || !process.env.SUPABASE_SECRET_KEY || !email) {
  throw new Error("Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and EMAIL (or SEED_EMAIL)");
}

const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const { users } = unwrap(await admin.auth.admin.listUsers({ perPage: 1000 }));
const user = users.find((candidate) => candidate.email === email);
if (!user) {
  throw new Error(`No account for ${email}. Sign up in the app first.`);
}

const existing = unwrap(await admin.from("prompt").select("id").eq("user_id", user.id));
if (existing.length > 0 && !reset) {
  throw new Error(`${email} already has ${existing.length} prompts. Re-run with --reset to replace them.`);
}
if (reset) {
  unwrap(await admin.from("prompt").delete().eq("user_id", user.id).select());
  unwrap(await admin.from("category").delete().eq("user_id", user.id).select());
  unwrap(await admin.from("tag").delete().eq("user_id", user.id).select());
}

const distinct = (values) => [...new Set(values)].map((name) => ({ user_id: user.id, name }));
const categories = unwrap(
  await admin
    .from("category")
    .insert(distinct(SEED_PROMPTS.flatMap((seed) => (seed.category ? [seed.category] : []))))
    .select(),
);
const tags = unwrap(
  await admin
    .from("tag")
    .insert(distinct(SEED_PROMPTS.flatMap((seed) => seed.tags)))
    .select(),
);
const idOf = (rows, name) => rows.find((row) => row.name === name).id;

for (const seed of SEED_PROMPTS) {
  const [prompt] = unwrap(
    await admin
      .from("prompt")
      .insert({
        user_id: user.id,
        title: seed.title,
        model: seed.model,
        category_id: seed.category ? idOf(categories, seed.category) : null,
      })
      .select(),
  );
  unwrap(
    await admin
      .from("prompt_version")
      .insert(seed.versions.map((body, index) => ({ prompt_id: prompt.id, version_number: index + 1, body })))
      .select(),
  );
  if (seed.tags.length > 0) {
    unwrap(
      await admin
        .from("prompt_tag")
        .insert(seed.tags.map((name) => ({ prompt_id: prompt.id, tag_id: idOf(tags, name), user_id: user.id })))
        .select(),
    );
  }
}

console.log(`Seeded ${SEED_PROMPTS.length} prompts for ${email}`);
