import type { AuthSession, AuthUser } from "@promptizer/shared";
import type { Session, User } from "@supabase/supabase-js";
import { fail, SERVICE_UNAVAILABLE, succeed, UNAUTHENTICATED } from "./outcome.ts";
import type { Failure, Outcome } from "./outcome.ts";
import { createAdminClient, createAnonymousClient } from "./supabase.ts";
import type { ChangePasswordInput, RegistrationInput, SignInInput } from "./validation.ts";

const INVALID_CREDENTIALS = fail(401, "invalid_credentials", "Email or password is incorrect.");
const REGISTRATION_REFUSED = fail(
  409,
  "registration_failed",
  "We couldn't create an account with those details. If you already have one, try signing in.",
);

interface ErrorLike {
  code?: string;
  status?: number;
}

const RATE_LIMITED = fail(429, "rate_limited", "Too many attempts. Please wait a moment and try again.");

function isServerSideError(error: ErrorLike): boolean {
  return error.status === undefined || error.status === 0 || error.status >= 500;
}

function isRateLimited(error: ErrorLike): boolean {
  return error.status === 429 || Boolean(error.code?.includes("rate_limit"));
}

function failureFor(error: ErrorLike, definiteFailure: { ok: false; failure: Failure }) {
  if (isRateLimited(error)) {
    return RATE_LIMITED;
  }
  return isServerSideError(error) ? SERVICE_UNAVAILABLE : definiteFailure;
}

function toAuthUser(user: User): AuthUser {
  const name = user.user_metadata?.name;
  return { id: user.id, email: user.email ?? "", name: typeof name === "string" ? name : "" };
}

function toAuthSession(session: Session): AuthSession {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in,
    user: toAuthUser(session.user),
  };
}

export async function signInWithPassword({ email, password }: SignInInput): Promise<Outcome<AuthSession>> {
  const { data, error } = await createAnonymousClient().auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return error ? failureFor(error, INVALID_CREDENTIALS) : INVALID_CREDENTIALS;
  }
  return succeed(toAuthSession(data.session));
}

export async function registerAccount({ email, password, name }: RegistrationInput): Promise<Outcome<AuthSession>> {
  const { error } = await createAdminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error) {
    if (isRateLimited(error) || isServerSideError(error)) {
      return failureFor(error, REGISTRATION_REFUSED);
    }
    if (error.code === "weak_password") {
      return fail(422, "validation_failed", "Please fix the highlighted fields.", {
        password: "Choose a stronger password.",
      });
    }
    return REGISTRATION_REFUSED;
  }
  return signInWithPassword({ email, password });
}

export async function refreshSession(refreshToken: string): Promise<Outcome<AuthSession>> {
  const { data, error } = await createAnonymousClient().auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) {
    return error ? failureFor(error, UNAUTHENTICATED) : UNAUTHENTICATED;
  }
  return succeed(toAuthSession(data.session));
}

export async function resolveUser(accessToken: string): Promise<Outcome<AuthUser>> {
  const { data, error } = await createAnonymousClient().auth.getUser(accessToken);
  if (error || !data.user) {
    return error ? failureFor(error, UNAUTHENTICATED) : UNAUTHENTICATED;
  }
  return succeed(toAuthUser(data.user));
}

export async function endSession(accessToken: string): Promise<void> {
  await createAdminClient().auth.admin.signOut(accessToken, "local");
}

export async function changePassword(
  user: AuthUser,
  { currentPassword, newPassword }: ChangePasswordInput,
): Promise<Outcome<AuthSession>> {
  const currentPasswordCheck = await signInWithPassword({ email: user.email, password: currentPassword });
  if (!currentPasswordCheck.ok) {
    return currentPasswordCheck.failure.body.code === "invalid_credentials"
      ? fail(422, "validation_failed", "Please fix the highlighted fields.", {
          currentPassword: "Your current password is incorrect.",
        })
      : currentPasswordCheck;
  }
  const { error } = await createAdminClient().auth.admin.updateUserById(user.id, { password: newPassword });
  if (error) {
    return failureFor(
      error,
      fail(422, "validation_failed", "Please fix the highlighted fields.", {
        newPassword: "Choose a stronger password.",
      }),
    );
  }
  return signInWithPassword({ email: user.email, password: newPassword });
}
