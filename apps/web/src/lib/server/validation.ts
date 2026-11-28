import {
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  PROMPTS_PAGE_SIZE,
  PROMPTS_PAGE_SIZE_MAX,
} from "@promptizer/shared";
import type {
  AuthFieldErrors,
  CategoryChanges,
  CategoryDraft,
  CategoryFieldErrors,
  PromptChanges,
  PromptDraft,
  PromptFieldErrors,
} from "@promptizer/shared";
import { categoryDraftProblems, normalizeCategoryName } from "../prompts/categories.ts";
import {
  normalizePromptTitle,
  normalizeSearchQuery,
  promptDraftProblems,
  removeUnsupportedCharacters,
} from "../prompts/prompts.ts";
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

function validationFailure(fields: AuthFieldErrors | PromptFieldErrors | CategoryFieldErrors) {
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

export interface PromptListQuery {
  query: string;
  categoryId?: string;
  tag?: string;
  page: number;
  pageSize: number;
}

const PROMPT_DRAFT_KEYS = ["title", "text", "categoryId"] as const;

function asRecord(body: unknown): Record<string, unknown> | undefined {
  return typeof body === "object" && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : undefined;
}

function pickPromptDraftFields(record: Record<string, unknown>): {
  title?: unknown;
  text?: unknown;
  categoryId?: unknown;
} {
  return Object.fromEntries(PROMPT_DRAFT_KEYS.filter((key) => key in record).map((key) => [key, record[key]]));
}

export function validatePromptDraft(body: unknown): Outcome<PromptDraft> {
  const fields = pickPromptDraftFields(asRecord(body) ?? {});
  const problems = promptDraftProblems(fields, "create");
  if (Object.keys(problems).length > 0) {
    return validationFailure(problems);
  }
  const draft: PromptDraft = { title: normalizePromptTitle(fields.title as string), text: fields.text as string };
  if (fields.categoryId !== undefined) {
    draft.categoryId = fields.categoryId as string | null;
  }
  return succeed(draft);
}

export function validatePromptChanges(body: unknown): Outcome<PromptChanges> {
  const record = asRecord(body);
  const fields = record ? pickPromptDraftFields(record) : {};
  if (Object.keys(fields).length === 0) {
    return fail(422, "validation_failed", "Nothing to update.");
  }
  const problems = promptDraftProblems(fields, "update");
  if (Object.keys(problems).length > 0) {
    return validationFailure(problems);
  }
  const changes: PromptChanges = {};
  if ("title" in fields) changes.title = normalizePromptTitle(fields.title as string);
  if ("text" in fields) changes.text = fields.text as string;
  if ("categoryId" in fields) changes.categoryId = fields.categoryId as string | null;
  return succeed(changes);
}

function parseBoundedInteger(raw: string | null, fallback: number, max: number): number | undefined {
  if (raw === null || raw === "") {
    return fallback;
  }
  if (!/^\d{1,9}$/.test(raw)) {
    return undefined;
  }
  const value = Number(raw);
  return value >= 1 && value <= max ? value : undefined;
}

export function parsePromptListQuery(searchParams: URLSearchParams): Outcome<PromptListQuery> {
  const page = parseBoundedInteger(searchParams.get("page"), 1, Number.MAX_SAFE_INTEGER);
  const pageSize = parseBoundedInteger(searchParams.get("pageSize"), PROMPTS_PAGE_SIZE, PROMPTS_PAGE_SIZE_MAX);
  const fields: PromptFieldErrors = {};
  if (page === undefined) {
    fields.page = "Use a page number of 1 or more.";
  }
  if (pageSize === undefined) {
    fields.pageSize = `Use a page size between 1 and ${PROMPTS_PAGE_SIZE_MAX}.`;
  }
  if (page === undefined || pageSize === undefined) {
    return validationFailure(fields);
  }
  const query = normalizeSearchQuery(searchParams.get("q") ?? "");
  const categoryId = searchParams.get("category")?.trim() || undefined;
  const tag = removeUnsupportedCharacters(searchParams.get("tag") ?? "").trim() || undefined;
  return succeed({ query, categoryId, tag, page, pageSize });
}

export function validateCategoryDraft(body: unknown): Outcome<CategoryDraft> {
  const record = asRecord(body) ?? {};
  const problems = categoryDraftProblems(record);
  if (Object.keys(problems).length > 0) {
    return validationFailure(problems);
  }
  return succeed({ name: normalizeCategoryName(record.name as string) });
}

export function validateCategoryChanges(body: unknown): Outcome<CategoryChanges> {
  const record = asRecord(body);
  if (!record || !("name" in record)) {
    return fail(422, "validation_failed", "Nothing to update.");
  }
  const problems = categoryDraftProblems(record);
  if (Object.keys(problems).length > 0) {
    return validationFailure(problems);
  }
  return succeed({ name: normalizeCategoryName(record.name as string) });
}
