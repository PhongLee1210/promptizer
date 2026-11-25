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
