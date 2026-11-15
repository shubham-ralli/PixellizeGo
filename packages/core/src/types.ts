/** Shared domain types used across packages and apps. */

export type UserRole = "admin" | "editor" | "author";

export interface PublicUser {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl: string | null;
  createdAt: string;
}

export interface SessionContext {
  user: PublicUser;
  sessionId: string;
}

/** Standard API error shape. */
export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
}
