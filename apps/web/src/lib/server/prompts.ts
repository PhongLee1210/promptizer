import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { PromptSource, PromptSummary } from "../prompts/prompts.ts";
import { ACCESS_COOKIE } from "./session-cookies.ts";

const SOURCE_BY_MODEL: Record<string, PromptSource> = { chatgpt: "ChatGPT", claude: "Claude", gemini: "Gemini" };

interface PromptRow {
  id: string;
  title: string;
  model: string | null;
  updated_at: string;
  category: { name: string } | null;
  prompt_tag: { tag: { name: string } | null }[];
  prompt_version: { version_number: number; body: string }[];
}

const PROMPT_COLUMNS =
  "id, title, model, updated_at, category(name), prompt_tag(tag(name)), prompt_version(version_number, body)";

function createUserClient(accessToken: string): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export function toPromptSummary(row: PromptRow): PromptSummary {
  const latest = row.prompt_version.reduce<PromptRow["prompt_version"][number] | undefined>(
    (newest, version) => (!newest || version.version_number > newest.version_number ? version : newest),
    undefined,
  );
  return {
    id: row.id,
    title: row.title,
    body: latest?.body ?? "",
    source: row.model ? (SOURCE_BY_MODEL[row.model] ?? null) : null,
    category: row.category?.name ?? null,
    tags: row.prompt_tag.flatMap(({ tag }) => (tag ? [tag.name] : [])).sort(),
    updatedAt: new Date(row.updated_at),
  };
}

export async function listPromptsForSession(): Promise<PromptSummary[]> {
  const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!accessToken) {
    return [];
  }
  const { data, error } = await createUserClient(accessToken)
    .from("prompt")
    .select(PROMPT_COLUMNS)
    .order("updated_at", { ascending: false })
    .overrideTypes<PromptRow[], { merge: false }>();
  if (error) {
    throw new Error(`Could not load prompts: ${error.message}`);
  }
  return data.map(toPromptSummary);
}
