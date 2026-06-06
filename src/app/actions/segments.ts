"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { SegmentVisibility } from "@/generated/prisma/enums";

export async function createSegment(formData: FormData) {
  const user = await requireUser();

  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error("List name is required");

  const description = (formData.get("description") as string)?.trim() || null;
  const visibility =
    (formData.get("visibility") as SegmentVisibility) ?? SegmentVisibility.SHARED;

  const segment = await prisma.segment.create({
    data: { name, description, visibility, ownerId: user.id },
  });

  revalidatePath("/lists");
  redirect(`/lists/${segment.id}`);
}

export async function deleteSegment(segmentId: string) {
  const user = await requireUser();
  // Only the owner can delete their list.
  await prisma.segment.deleteMany({ where: { id: segmentId, ownerId: user.id } });
  revalidatePath("/lists");
  redirect("/lists");
}
