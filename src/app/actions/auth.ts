"use server";

import { redirect } from "next/navigation";
import { clearCurrentUser, setCurrentUserId } from "@/lib/session";

export async function loginAs(userId: string) {
  await setCurrentUserId(userId);
  redirect("/dashboard");
}

export async function logout() {
  await clearCurrentUser();
  redirect("/login");
}
