import { SESSION_TTL_SECONDS } from "./session";

export const SESSION_COOKIE = "favor_session";

export function sessionCookieOptions(maxAge: number = SESSION_TTL_SECONDS) {
  return { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge };
}
