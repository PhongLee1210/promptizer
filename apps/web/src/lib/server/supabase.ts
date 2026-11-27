import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

const STATELESS_AUTH = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const REQUIRED_VARIABLES = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"];

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

export function isSupabaseConfigured(): boolean {
  return REQUIRED_VARIABLES.every((name) => Boolean(process.env[name]));
}

export function createAnonymousClient(): SupabaseClient {
  return createClient(
    requireEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnvironmentVariable("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    STATELESS_AUTH,
  );
}

export function createAdminClient(): SupabaseClient {
  return createClient(
    requireEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnvironmentVariable("SUPABASE_SECRET_KEY"),
    STATELESS_AUTH,
  );
}

export function createUserClient(accessToken: string): SupabaseClient {
  return createClient(
    requireEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnvironmentVariable("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    { ...STATELESS_AUTH, global: { headers: { Authorization: `Bearer ${accessToken}` } } },
  );
}
