export const PRODUCT_NAME = "Promptizer";

export const EMAIL_MAX_LENGTH = 254;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72;
export const CLIENT_KIND_HEADER = "X-Promptizer-Client";
export const EXTENSION_CLIENT_KIND = "extension";
export const NAME_MAX_LENGTH = 80;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: AuthUser;
}

export type AuthErrorCode =
  | "validation_failed"
  | "registration_failed"
  | "invalid_credentials"
  | "unauthenticated"
  | "rate_limited"
  | "service_unavailable";

export type AuthFieldErrors = Partial<
  Record<"email" | "password" | "name" | "currentPassword" | "newPassword", string>
>;

export interface AuthErrorBody {
  code: AuthErrorCode;
  message: string;
  fields?: AuthFieldErrors;
}

export const PROMPT_TITLE_MAX_LENGTH = 200;
export const PROMPT_TEXT_MAX_LENGTH = 20_000;
export const PROMPTS_PAGE_SIZE = 12;
export const PROMPTS_PAGE_SIZE_MAX = 50;
export const PROMPT_SEARCH_MAX_LENGTH = 200;

export type PromptModel = "chatgpt" | "claude" | "gemini";

export const CATEGORY_NAME_MAX_LENGTH = 80;

export interface CategorySummary {
  id: string;
  name: string;
}

export interface CategoryDraft {
  name: string;
}

export interface PackSummary extends CategorySummary {
  promptCount: number;
}

export type CategoryChanges = Partial<CategoryDraft>;

export type CategoryField = "name";

export type CategoryFieldErrors = Partial<Record<CategoryField, string>>;

export interface Prompt {
  id: string;
  title: string;
  text: string;
  model: PromptModel | null;
  category: CategorySummary | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PromptDraft {
  title: string;
  text: string;
  categoryId?: string | null;
}

export type PromptChanges = Partial<PromptDraft>;

export interface PromptListPage {
  items: Prompt[];
  total: number;
  page: number;
  pageSize: number;
}

export type ApiErrorCode = AuthErrorCode | "not_found";

export type PromptField = "title" | "text" | "categoryId" | "page" | "pageSize";

export type PromptFieldErrors = Partial<Record<PromptField, string>>;

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  fields?: Partial<Record<string, string>>;
}

export function countCharacters(value: string): number {
  return Array.from(value).length;
}
