import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "crm_user_id";

/** Read the current user's id from the session cookie (or null). */
export async function getCurrentUserId(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}

/** Fetch the current user, or null if not logged in / cookie stale. */
export async function getCurrentUser() {
  const id = await getCurrentUserId();
  if (!id) return null;
  return prisma.user.findUnique({ where: { id } });
}

/** Like getCurrentUser, but redirects to /login when there is no valid user. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Set the session cookie to the given user id. */
export async function setCurrentUserId(userId: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year — this is a trusted local tool
  });
}

/** Clear the session cookie. */
export async function clearCurrentUser() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
