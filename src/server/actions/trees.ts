"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { familyTrees, persons, treeMembers } from "@/db/schema";
import { slugifyTreeName } from "@/lib/genealogy/dag";
import {
  createTreeSchema,
  type CreateTreeValues,
} from "@/lib/validations/trees";
import { requireUser } from "@/server/dal/auth";
import { importLegacyFamilyTree } from "@/server/importers/legacy-sql";

export async function createFamilyTreeAction(input: CreateTreeValues) {
  const { user } = await requireUser();
  const parsed = createTreeSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid tree details.",
    };
  }

  const baseSlug = slugifyTreeName(parsed.data.name);
  let slug = baseSlug;
  const conflict = await db.query.familyTrees.findFirst({
    where: eq(familyTrees.slug, slug),
  });
  if (conflict) {
    slug = `${baseSlug}-${crypto.randomBytes(3).toString("hex")}`;
  }

  const created = await db.transaction(async (tx) => {
    const [tree] = await tx
      .insert(familyTrees)
      .values({
        name: parsed.data.name,
        slug,
        description: parsed.data.description || null,
        createdById: user.id,
      })
      .returning();

    const [rootPerson] = await tx
      .insert(persons)
      .values({
        treeId: tree.id,
        displayName: parsed.data.firstPersonName,
        fullName: parsed.data.firstPersonName,
        gender: parsed.data.firstPersonGender,
        isLiving: true,
        createdById: user.id,
      })
      .returning();

    await tx
      .update(familyTrees)
      .set({ rootPersonId: rootPerson.id })
      .where(eq(familyTrees.id, tree.id));

    await tx.insert(treeMembers).values({
      treeId: tree.id,
      userId: user.id,
      role: "owner",
      claimedPersonId: parsed.data.claimAsSelf ? rootPerson.id : null,
    });

    return tree;
  });

  revalidatePath("/trees");
  return { ok: true as const, slug: created.slug };
}

export async function importLegacyTreeAction() {
  const { user } = await requireUser();

  try {
    const result = await importLegacyFamilyTree({
      ownerUserId: user.id,
    });
    revalidatePath("/trees");
    return {
      ok: true as const,
      slug: result.slug,
      personsCount: result.personsCount,
      partnershipsCount: result.partnershipsCount,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to import legacy SQL.";
    return {
      ok: false as const,
      error: message,
    };
  }
}
