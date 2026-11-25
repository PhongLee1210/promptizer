import { EMAIL_MAX_LENGTH, NAME_MAX_LENGTH, PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH } from "@promptizer/shared";
import type { AuthFieldErrors } from "@promptizer/shared";
import { fail, succeed } from "./outcome.ts";
import type { Outcome } from "./outcome.ts";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const textEncoder = new TextEncoder();

export interface RegistrationInput {
  email: string;
  password: string;
  name: string;
}

export interface SignInInput {
  email: string;
  password: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

function readField(body: unknown, field: string): string | undefined {
  if (typeof body !== "object" || body === null) {
    return undefined;
  }
  const value = (body as Record<string, unknown>)[field];
  return typeof value === "string" ? value : undefined;
}

function checkEmail(value: string | undefined): string | undefined {
  const email = value?.trim().toLowerCase();
  if (!email) {
    return undefined;
  }
  return email.length <= EMAIL_MAX_LENGTH && EMAIL_PATTERN.test(email) ? email : undefined;
}

function passwordProblem(password: string | undefined): string | undefined {
  if (!password) {
    return "Enter a password.";
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (textEncoder.encode(password).length > PASSWORD_MAX_BYTES) {
    return "This password is too long.";
  }
  return undefined;
}

function validationFailure(fields: AuthFieldErrors) {
  return fail(422, "validation_failed", "Please fix the highlighted fields.", fields);
}

export function validateRegistration(body: unknown): Outcome<RegistrationInput> {
  const email = checkEmail(readField(body, "email"));
  const password = readField(body, "password");
  const name = readField(body, "name")?.trim();
  const fields: AuthFieldErrors = {};
  if (!email) {
    fields.email = "Enter a valid email address.";
  }
  const passwordIssue = passwordProblem(password);
  if (passwordIssue) {
    fields.password = passwordIssue;
  }
  if (!name) {
    fields.name = "Enter your name.";
  } else if (name.length > NAME_MAX_LENGTH) {
    fields.name = `Use at most ${NAME_MAX_LENGTH} characters.`;
  }
  if (Object.keys(fields).length > 0 || !email || !password || !name) {
    return validationFailure(fields);
  }
  return succeed({ email, password, name });
}

export function validateSignIn(body: unknown): Outcome<SignInInput> {
  const email = checkEmail(readField(body, "email"));
  const password = readField(body, "password");
  if (!email || !password || textEncoder.encode(password).length > PASSWORD_MAX_BYTES) {
    return fail(401, "invalid_credentials", "Email or password is incorrect.");
  }
  return succeed({ email, password });
}

export function validateChangePassword(body: unknown): Outcome<ChangePasswordInput> {
  const currentPassword = readField(body, "currentPassword");
  const newPassword = readField(body, "newPassword");
  const fields: AuthFieldErrors = {};
  if (!currentPassword) {
    fields.currentPassword = "Enter your current password.";
  }
  const newPasswordIssue = passwordProblem(newPassword);
  if (newPasswordIssue) {
    fields.newPassword = newPasswordIssue;
  }
  if (Object.keys(fields).length > 0 || !currentPassword || !newPassword) {
    return validationFailure(fields);
  }
  return succeed({ currentPassword, newPassword });
}
