"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  familyTrees,
  treeMembers,
  type TreeRole,
  treeShareLinks,
  user,
} from "@/db/schema";
import { requireUser } from "@/server/dal/auth";
import {
  hashPasscode,
  setShareAccessCookie,
  verifyPasscode,
} from "@/server/dal/share-session";

async function requireTreeOwner(treeId: string) {
  const { user: currentUser } = await requireUser();
  const [tree, membership] = await Promise.all([
    db.query.familyTrees.findFirst({ where: eq(familyTrees.id, treeId) }),
    db.query.treeMembers.findFirst({
      where: and(
        eq(treeMembers.treeId, treeId),
        eq(treeMembers.userId, currentUser.id),
      ),
    }),
  ]);

  if (!tree || !membership || membership.role !== "owner") {
    throw new Error("Only the Tree Owner can manage sharing and collaborators.");
  }
  return { currentUser, tree };
}

export async function addCollaboratorByEmailAction(input: {
  treeId: string;
  email: string;
  role: Exclude<TreeRole, "owner">;
}) {
  try {
    const { tree } = await requireTreeOwner(input.treeId);
    const targetEmail = input.email.trim().toLowerCase();

    const targetUser = await db.query.user.findFirst({
      where: eq(user.email, targetEmail),
    });

    if (!targetUser) {
      return {
        ok: false as const,
        error:
          "No Shikor account found with that email yet. Ask them to sign in once, or share a Passcode Link below!",
      };
    }

    await db
      .insert(treeMembers)
      .values({
        treeId: input.treeId,
        userId: targetUser.id,
        role: input.role,
      })
      .onConflictDoUpdate({
        target: [treeMembers.treeId, treeMembers.userId],
        set: { role: input.role },
      });

    revalidatePath(`/trees/${tree.slug}`);
    return { ok: true as const };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Failed to add collaborator.",
    };
  }
}

export async function removeCollaboratorAction(input: {
  treeId: string;
  memberId: string;
}) {
  try {
    const { tree } = await requireTreeOwner(input.treeId);
    const target = await db.query.treeMembers.findFirst({
      where: and(
        eq(treeMembers.id, input.memberId),
        eq(treeMembers.treeId, input.treeId),
      ),
    });
    if (!target || target.role === "owner") {
      return { ok: false as const, error: "Cannot remove the Tree Owner." };
    }

    await db.delete(treeMembers).where(eq(treeMembers.id, input.memberId));
    revalidatePath(`/trees/${tree.slug}`);
    return { ok: true as const };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Failed to remove member.",
    };
  }
}

export async function createShareLinkAction(input: {
  treeId: string;
  label: string;
  passcode: string;
}) {
  try {
    const { currentUser, tree } = await requireTreeOwner(input.treeId);
    const cleanPasscode = input.passcode.trim();
    if (cleanPasscode.length < 4) {
      return {
        ok: false as const,
        error: "Passcode must be at least 4 characters.",
      };
    }

    const token = crypto.randomBytes(12).toString("base64url");
    const passcodeHash = hashPasscode(cleanPasscode);

    await db.insert(treeShareLinks).values({
      treeId: input.treeId,
      token,
      label: input.label.trim() || "Family Share Link",
      passcodeHash,
      isActive: true,
      createdById: currentUser.id,
    });

    revalidatePath(`/trees/${tree.slug}`);
    return { ok: true as const, token };
  } catch (err) {
    return {
      ok: false as const,
      error:
        err instanceof Error ? err.message : "Failed to create share link.",
    };
  }
}

export async function toggleShareLinkAction(input: {
  treeId: string;
  linkId: string;
  isActive: boolean;
}) {
  try {
    const { tree } = await requireTreeOwner(input.treeId);
    await db
      .update(treeShareLinks)
      .set({ isActive: input.isActive })
      .where(
        and(
          eq(treeShareLinks.id, input.linkId),
          eq(treeShareLinks.treeId, input.treeId),
        ),
      );
    revalidatePath(`/trees/${tree.slug}`);
    return { ok: true as const };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Failed to update share link.",
    };
  }
}

export async function unlockShareLinkAction(input: {
  token: string;
  passcode: string;
}) {
  const link = await db.query.treeShareLinks.findFirst({
    where: eq(treeShareLinks.token, input.token),
  });
  if (!link || !link.isActive) {
    return { ok: false as const, error: "This share link is no longer active." };
  }
  if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
    return { ok: false as const, error: "This share link has expired." };
  }

  const valid = verifyPasscode(input.passcode.trim(), link.passcodeHash);
  if (!valid) {
    return { ok: false as const, error: "Incorrect passcode. Please try again." };
  }

  await db
    .update(treeShareLinks)
    .set({ lastAccessedAt: new Date() })
    .where(eq(treeShareLinks.id, link.id));

  await setShareAccessCookie(link.treeId, link.id);
  revalidatePath(`/share/${input.token}`);
  return { ok: true as const };
}
