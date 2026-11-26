import "server-only";

import { and, asc, count, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/db";
import {
  familyTrees,
  lifeEvents,
  parentChildLinks,
  partnerships,
  persons,
  treeMembers,
  type TreeRole,
  treeShareLinks,
  user,
} from "@/db/schema";
import { requireUser } from "./auth";
import { getValidShareLinkIdFromCookie } from "./share-session";

export interface UserTreeSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  role: TreeRole;
  claimedPersonName: string | null;
  personsCount: number;
  partnershipsCount: number;
  updatedAt: Date;
}

export async function listUserTrees(): Promise<UserTreeSummary[]> {
  const { user: currentUser } = await requireUser();

  const memberships = await db
    .select({
      tree: familyTrees,
      role: treeMembers.role,
      claimedPersonName: persons.displayName,
    })
    .from(treeMembers)
    .innerJoin(familyTrees, eq(treeMembers.treeId, familyTrees.id))
    .leftJoin(persons, eq(treeMembers.claimedPersonId, persons.id))
    .where(eq(treeMembers.userId, currentUser.id))
    .orderBy(desc(familyTrees.updatedAt));

  if (memberships.length === 0) return [];

  const summaries = await Promise.all(
    memberships.map(async (m) => {
      const [[pCount], [uCount]] = await Promise.all([
        db
          .select({ value: count() })
          .from(persons)
          .where(eq(persons.treeId, m.tree.id)),
        db
          .select({ value: count() })
          .from(partnerships)
          .where(eq(partnerships.treeId, m.tree.id)),
      ]);

      return {
        id: m.tree.id,
        name: m.tree.name,
        slug: m.tree.slug,
        description: m.tree.description,
        role: m.role,
        claimedPersonName: m.claimedPersonName ?? null,
        personsCount: pCount?.value ?? 0,
        partnershipsCount: uCount?.value ?? 0,
        updatedAt: m.tree.updatedAt,
      };
    }),
  );

  return summaries;
}

export interface TreeWorkspaceData {
  tree: typeof familyTrees.$inferSelect;
  accessRole: TreeRole | "guest";
  canEdit: boolean;
  canManage: boolean;
  claimedPersonId: string | null;
  persons: Array<typeof persons.$inferSelect>;
  partnerships: Array<typeof partnerships.$inferSelect>;
  parentChildLinks: Array<typeof parentChildLinks.$inferSelect>;
  lifeEvents: Array<typeof lifeEvents.$inferSelect>;
  collaborators: Array<{
    memberId: string;
    userId: string;
    name: string;
    email: string;
    image: string | null;
    role: TreeRole;
    claimedPersonId: string | null;
  }>;
  shareLinks: Array<{
    id: string;
    token: string;
    label: string;
    isActive: boolean;
    expiresAt: Date | null;
    createdAt: Date;
  }>;
}

async function loadTreeGraphPayload(treeId: string) {
  const [treePersons, treePartnerships, treeLinks, treeEvents] =
    await Promise.all([
      db
        .select()
        .from(persons)
        .where(eq(persons.treeId, treeId))
        .orderBy(asc(persons.siblingOrder), asc(persons.displayName)),
      db
        .select()
        .from(partnerships)
        .where(eq(partnerships.treeId, treeId))
        .orderBy(asc(partnerships.marriageOrder)),
      db
        .select()
        .from(parentChildLinks)
        .where(eq(parentChildLinks.treeId, treeId)),
      db
        .select()
        .from(lifeEvents)
        .where(eq(lifeEvents.treeId, treeId))
        .orderBy(asc(lifeEvents.sortYear), asc(lifeEvents.createdAt)),
    ]);

  return {
    persons: treePersons,
    partnerships: treePartnerships,
    parentChildLinks: treeLinks,
    lifeEvents: treeEvents,
  };
}

export async function getTreeWorkspaceBySlug(
  slug: string,
): Promise<TreeWorkspaceData> {
  const { user: currentUser } = await requireUser();

  const tree = await db.query.familyTrees.findFirst({
    where: eq(familyTrees.slug, slug),
  });
  if (!tree) {
    notFound();
  }

  const membership = await db.query.treeMembers.findFirst({
    where: and(
      eq(treeMembers.treeId, tree.id),
      eq(treeMembers.userId, currentUser.id),
    ),
  });

  if (!membership) {
    notFound();
  }

  const canEdit = membership.role === "owner" || membership.role === "editor";
  const canManage = membership.role === "owner";

  const [graph, collaborators, shareLinks] = await Promise.all([
    loadTreeGraphPayload(tree.id),
    db
      .select({
        memberId: treeMembers.id,
        userId: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: treeMembers.role,
        claimedPersonId: treeMembers.claimedPersonId,
      })
      .from(treeMembers)
      .innerJoin(user, eq(treeMembers.userId, user.id))
      .where(eq(treeMembers.treeId, tree.id)),
    canManage
      ? db
          .select({
            id: treeShareLinks.id,
            token: treeShareLinks.token,
            label: treeShareLinks.label,
            isActive: treeShareLinks.isActive,
            expiresAt: treeShareLinks.expiresAt,
            createdAt: treeShareLinks.createdAt,
          })
          .from(treeShareLinks)
          .where(eq(treeShareLinks.treeId, tree.id))
          .orderBy(desc(treeShareLinks.createdAt))
      : Promise.resolve([]),
  ]);

  return {
    tree,
    accessRole: membership.role,
    canEdit,
    canManage,
    claimedPersonId: membership.claimedPersonId,
    ...graph,
    collaborators,
    shareLinks,
  };
}

export async function getSharedTreeWorkspaceByToken(token: string): Promise<
  | {
      status: "locked";
      token: string;
      treeName: string;
      label: string;
    }
  | {
      status: "unlocked";
      workspace: TreeWorkspaceData;
    }
> {
  const link = await db.query.treeShareLinks.findFirst({
    where: eq(treeShareLinks.token, token),
  });

  if (!link || !link.isActive) {
    notFound();
  }

  if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
    notFound();
  }

  const tree = await db.query.familyTrees.findFirst({
    where: eq(familyTrees.id, link.treeId),
  });
  if (!tree) {
    notFound();
  }

  const validLinkId = await getValidShareLinkIdFromCookie(tree.id);
  if (validLinkId !== link.id) {
    return {
      status: "locked",
      token: link.token,
      treeName: tree.name,
      label: link.label,
    };
  }

  const graph = await loadTreeGraphPayload(tree.id);

  return {
    status: "unlocked",
    workspace: {
      tree,
      accessRole: "guest",
      canEdit: false,
      canManage: false,
      claimedPersonId: null,
      ...graph,
      collaborators: [],
      shareLinks: [],
    },
  };
}
