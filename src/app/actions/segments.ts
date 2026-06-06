"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export async function createSegment(formData: FormData) {
  const user = await requireUser();

  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error("List name is required");

  const description = (formData.get("description") as string)?.trim() || null;
  const assigneeId = (formData.get("assigneeId") as string)?.trim() || null;

  const segment = await prisma.segment.create({
    data: { name, description, ownerId: user.id, assigneeId },
  });

  revalidatePath("/lists");
  revalidatePath("/dashboard");
  redirect(`/lists/${segment.id}`);
}

/** Reassign a list to a person (or null to unassign). */
export async function setSegmentAssignee(segmentId: string, assigneeId: string | null) {
  await requireUser();
  await prisma.segment.update({
    where: { id: segmentId },
    data: { assigneeId: assigneeId || null },
  });
  revalidatePath(`/lists/${segmentId}`);
  revalidatePath("/lists");
  revalidatePath("/dashboard");
}

export async function deleteSegment(segmentId: string) {
  const user = await requireUser();
  // Only the creator can delete their list.
  await prisma.segment.deleteMany({ where: { id: segmentId, ownerId: user.id } });
  revalidatePath("/lists");
  redirect("/lists");
}
