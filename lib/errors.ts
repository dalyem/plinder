import { ConvexError } from "convex/values";

export type AppErrorCode =
  | "UNAUTHORIZED"
  | "WAITLISTED"
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "BAD_STATE"
  | "NAME_TAKEN"
  | "SESSION_FULL"
  | "SESSION_ENDED"
  | "SUPERLIKE_BUDGET"
  | "TOO_FEW_MATCHES"
  | "PLEX_UNREACHABLE"
  | "PLEX_ERROR"
  | "CONFIG";

export function errorCode(err: unknown): AppErrorCode | "UNKNOWN" {
  if (err instanceof ConvexError) {
    const data = err.data as { code?: string } | string;
    if (typeof data === "object" && data?.code) return data.code as AppErrorCode;
  }
  return "UNKNOWN";
}

export function errorMessage(err: unknown): string {
  if (err instanceof ConvexError) {
    const data = err.data as { message?: string } | string;
    if (typeof data === "object" && data?.message) return data.message;
    if (typeof data === "string") return data;
  }
  return "Something went wrong. Please try again.";
}
