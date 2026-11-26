"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  type BloodGroup,
  type DatePrecision,
  familyTrees,
  type Gender,
  type LifeEventType,
  lifeEvents,
  type LineageType,
  parentChildLinks,
  type PartnershipStatus,
  partnerships,
  persons,
  treeMembers,
} from "@/db/schema";
import { wouldCreateAncestorCycle } from "@/lib/genealogy/dag";
import { requireUser } from "@/server/dal/auth";
import { geocodeCityCountry } from "@/server/dal/geocode";

async function requireTreeEditor(treeId: string) {
  const { user } = await requireUser();
  const [tree, membership] = await Promise.all([
    db.query.familyTrees.findFirst({ where: eq(familyTrees.id, treeId) }),
    db.query.treeMembers.findFirst({
      where: and(
        eq(treeMembers.treeId, treeId),
        eq(treeMembers.userId, user.id),
      ),
    }),
  ]);

  if (!tree || !membership) {
    throw new Error("Tree not found or access denied.");
  }
  if (membership.role !== "owner" && membership.role !== "editor") {
    throw new Error("You only have read-only access to this family tree.");
  }
  return { user, tree, membership };
}

function parseYearFromInput(
  precision: DatePrecision,
  exactDate?: string | null,
  yearInput?: number | null,
  textInput?: string | null,
): number | null {
  if (precision === "exact" && exactDate && /^\d{4}/.test(exactDate)) {
    return Number.parseInt(exactDate.slice(0, 4), 10);
  }
  if (yearInput && !Number.isNaN(yearInput)) return yearInput;
  const match = textInput?.match(/(\d{4})/);
  return match ? Number.parseInt(match[1], 10) : null;
}

export interface UpdatePersonPayload {
  treeId: string;
  personId: string;
  displayName: string;
  fullName?: string | null;
  nickname?: string | null;
  nativeName?: string | null;
  isNameUnknown?: boolean;
  placeholderLabel?: string | null;
  gender: Gender;
  isLiving: boolean;
  birthDatePrecision: DatePrecision;
  birthDate?: string | null;
  birthYear?: number | null;
  birthDateText?: string | null;
  deathDatePrecision: DatePrecision;
  deathDate?: string | null;
  deathYear?: number | null;
  deathDateText?: string | null;
  bloodGroup?: BloodGroup | null;
  occupation?: string | null;
  education?: string | null;
  bioMarkdown?: string | null;
  nationality?: string | null;
  birthPlace?: string | null;
  currentCity?: string | null;
  currentCountry?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  avatarUrl?: string | null;
  siblingOrder?: number;
  isTwin?: boolean;
}

function sanitizeCoord(
  val: number | null | undefined,
  min: number,
  max: number,
): number | null {
  if (typeof val !== "number" || !Number.isFinite(val)) return null;
  if (val < min || val > max) return null;
  return Number(val.toFixed(6));
}

export async function updatePersonAction(input: UpdatePersonPayload) {
  try {
    const { tree } = await requireTreeEditor(input.treeId);

    let latitude = sanitizeCoord(input.latitude, -90, 90);
    let longitude = sanitizeCoord(input.longitude, -180, 180);

    if (
      (latitude === null || longitude === null) &&
      (input.currentCity?.trim() || input.currentCountry?.trim())
    ) {
      const coords = await geocodeCityCountry(
        input.currentCity,
        input.currentCountry,
      );
      if (coords) {
        latitude = Number(coords.latitude.toFixed(6));
        longitude = Number(coords.longitude.toFixed(6));
      }
    }

    const birthYear = parseYearFromInput(
      input.birthDatePrecision,
      input.birthDate,
      input.birthYear,
      input.birthDateText,
    );
    const deathYear = parseYearFromInput(
      input.deathDatePrecision,
      input.deathDate,
      input.deathYear,
      input.deathDateText,
    );

    await db
      .update(persons)
      .set({
        displayName: input.displayName.trim() || "Unnamed Relative",
        fullName: input.fullName?.trim() || null,
        nickname: input.nickname?.trim() || null,
        nativeName: input.nativeName?.trim() || null,
        isNameUnknown: Boolean(input.isNameUnknown),
        placeholderLabel: input.placeholderLabel?.trim() || null,
        gender: input.gender,
        isLiving: input.isLiving,
        birthDatePrecision: input.birthDatePrecision,
        birthDate:
          input.birthDatePrecision === "exact" && input.birthDate
            ? input.birthDate
            : null,
        birthYear,
        birthDateText: input.birthDateText?.trim() || input.birthDate || null,
        deathDatePrecision: input.deathDatePrecision,
        deathDate:
          input.deathDatePrecision === "exact" && input.deathDate
            ? input.deathDate
            : null,
        deathYear,
        deathDateText: input.deathDateText?.trim() || input.deathDate || null,
        bloodGroup: input.bloodGroup || null,
        occupation: input.occupation?.trim() || null,
        education: input.education?.trim() || null,
        bioMarkdown: input.bioMarkdown?.trim() || null,
        nationality: input.nationality?.trim() || null,
        birthPlace: input.birthPlace?.trim() || null,
        currentCity: input.currentCity?.trim() || null,
        currentCountry: input.currentCountry?.trim() || null,
        latitude,
        longitude,
        contactPhone: input.contactPhone?.trim() || null,
        contactEmail: input.contactEmail?.trim() || null,
        avatarUrl: input.avatarUrl ?? undefined,
        siblingOrder: input.siblingOrder ?? 0,
        isTwin: Boolean(input.isTwin),
      })
      .where(
        and(eq(persons.id, input.personId), eq(persons.treeId, input.treeId)),
      );

    revalidatePath(`/trees/${tree.slug}`);
    return { ok: true as const };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Failed to update person.",
    };
  }
}

export type QuickRelativeRelation =
  | "father"
  | "mother"
  | "spouse"
  | "child"
  | "sibling";

export async function quickAddRelativeAction(input: {
  treeId: string;
  anchorPersonId: string;
  relation: QuickRelativeRelation;
  displayName: string;
  nickname?: string;
  nativeName?: string;
  gender: Gender;
  isLiving: boolean;
  lineageType?: LineageType;
  partnershipStatus?: PartnershipStatus;
  otherParentOrPartnershipId?: string | null;
}) {
  try {
    const { user, tree } = await requireTreeEditor(input.treeId);

    const anchor = await db.query.persons.findFirst({
      where: and(
        eq(persons.id, input.anchorPersonId),
        eq(persons.treeId, input.treeId),
      ),
    });
    if (!anchor) {
      return { ok: false as const, error: "Selected person not found." };
    }

    const lineage: LineageType = input.lineageType ?? "biological";

    const newPerson = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(persons)
        .values({
          treeId: input.treeId,
          displayName: input.displayName.trim(),
          fullName: input.displayName.trim(),
          nickname: input.nickname?.trim() || null,
          nativeName: input.nativeName?.trim() || null,
          gender: input.gender,
          isLiving: input.isLiving,
          createdById: user.id,
        })
        .returning();

      if (input.relation === "father" || input.relation === "mother") {
        // Check if anchor already has the other biological parent so we can auto-create/link their union!
        const existingParentLinks = await tx
          .select()
          .from(parentChildLinks)
          .where(
            and(
              eq(parentChildLinks.treeId, input.treeId),
              eq(parentChildLinks.childId, anchor.id),
              eq(parentChildLinks.lineageType, "biological"),
            ),
          );

        const oppositeRole = input.relation === "father" ? "mother" : "father";
        const otherParentLink = existingParentLinks.find(
          (l) => l.parentRole === oppositeRole,
        );

        let partnershipId: string | null = null;
        if (otherParentLink && lineage === "biological") {
          const [union] = await tx
            .insert(partnerships)
            .values({
              treeId: input.treeId,
              partner1Id:
                input.relation === "father"
                  ? created.id
                  : otherParentLink.parentId,
              partner2Id:
                input.relation === "mother"
                  ? created.id
                  : otherParentLink.parentId,
              status: "married",
            })
            .returning();
          partnershipId = union.id;

          await tx
            .update(parentChildLinks)
            .set({ partnershipId })
            .where(eq(parentChildLinks.id, otherParentLink.id));
        }

        await tx.insert(parentChildLinks).values({
          treeId: input.treeId,
          parentId: created.id,
          childId: anchor.id,
          partnershipId,
          lineageType: lineage,
          parentRole: input.relation,
        });
      } else if (input.relation === "spouse") {
        await tx.insert(partnerships).values({
          treeId: input.treeId,
          partner1Id: anchor.id,
          partner2Id: created.id,
          status: input.partnershipStatus ?? "married",
        });
      } else if (input.relation === "child") {
        let partnershipId: string | null = null;
        let coParentId: string | null = null;

        if (input.otherParentOrPartnershipId) {
          const union = await tx.query.partnerships.findFirst({
            where: and(
              eq(partnerships.id, input.otherParentOrPartnershipId),
              eq(partnerships.treeId, input.treeId),
            ),
          });
          if (union) {
            partnershipId = union.id;
            coParentId =
              union.partner1Id === anchor.id
                ? union.partner2Id
                : union.partner1Id;
          }
        } else {
          // If anchor has exactly 1 partnership, attach child to that partnership automatically
          const anchorUnions = await tx
            .select()
            .from(partnerships)
            .where(eq(partnerships.treeId, input.treeId));
          const myUnions = anchorUnions.filter(
            (u) => u.partner1Id === anchor.id || u.partner2Id === anchor.id,
          );
          if (myUnions.length === 1) {
            partnershipId = myUnions[0].id;
            coParentId =
              myUnions[0].partner1Id === anchor.id
                ? myUnions[0].partner2Id
                : myUnions[0].partner1Id;
          }
        }

        const anchorRole =
          anchor.gender === "M"
            ? "father"
            : anchor.gender === "F"
              ? "mother"
              : "parent";

        await tx.insert(parentChildLinks).values({
          treeId: input.treeId,
          parentId: anchor.id,
          childId: created.id,
          partnershipId,
          lineageType: lineage,
          parentRole: anchorRole,
        });

        if (coParentId) {
          const coParent = await tx.query.persons.findFirst({
            where: eq(persons.id, coParentId),
          });
          const coRole =
            coParent?.gender === "M"
              ? "father"
              : coParent?.gender === "F"
                ? "mother"
                : "parent";
          await tx.insert(parentChildLinks).values({
            treeId: input.treeId,
            parentId: coParentId,
            childId: created.id,
            partnershipId,
            lineageType: lineage,
            parentRole: coRole,
          });
        }
      } else if (input.relation === "sibling") {
        const anchorParentLinks = await tx
          .select()
          .from(parentChildLinks)
          .where(
            and(
              eq(parentChildLinks.treeId, input.treeId),
              eq(parentChildLinks.childId, anchor.id),
            ),
          );

        if (anchorParentLinks.length === 0) {
          // Create an unknown placeholder parent so the two siblings connect cleanly on the DAG!
          const [placeholderParent] = await tx
            .insert(persons)
            .values({
              treeId: input.treeId,
              displayName: `Parent of ${anchor.displayName}`,
              isNameUnknown: true,
              placeholderLabel: `Parent of ${anchor.displayName}`,
              gender: "U",
              isLiving: false,
              createdById: user.id,
            })
            .returning();

          await tx.insert(parentChildLinks).values([
            {
              treeId: input.treeId,
              parentId: placeholderParent.id,
              childId: anchor.id,
              lineageType: "biological",
              parentRole: "parent",
            },
            {
              treeId: input.treeId,
              parentId: placeholderParent.id,
              childId: created.id,
              lineageType: lineage,
              parentRole: "parent",
            },
          ]);
        } else {
          await tx.insert(parentChildLinks).values(
            anchorParentLinks.map((l) => ({
              treeId: input.treeId,
              parentId: l.parentId,
              childId: created.id,
              partnershipId: l.partnershipId,
              lineageType: lineage,
              parentRole: l.parentRole,
            })),
          );
        }
      }

      return created;
    });

    revalidatePath(`/trees/${tree.slug}`);
    return { ok: true as const, personId: newPerson.id };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Failed to add relative.",
    };
  }
}

export async function linkExistingRelativeAction(input: {
  treeId: string;
  sourcePersonId: string;
  targetPersonId: string;
  linkKind: "spouse" | "parent" | "child";
  lineageType?: LineageType;
  partnershipStatus?: PartnershipStatus;
}) {
  try {
    const { tree } = await requireTreeEditor(input.treeId);
    if (input.sourcePersonId === input.targetPersonId) {
      return { ok: false as const, error: "Cannot link a person to themselves." };
    }

    if (input.linkKind === "spouse") {
      await db.insert(partnerships).values({
        treeId: input.treeId,
        partner1Id: input.sourcePersonId,
        partner2Id: input.targetPersonId,
        status: input.partnershipStatus ?? "married",
      });
    } else {
      const parentId =
        input.linkKind === "parent" ? input.targetPersonId : input.sourcePersonId;
      const childId =
        input.linkKind === "parent" ? input.sourcePersonId : input.targetPersonId;

      const existingLinks = await db
        .select({
          parentId: parentChildLinks.parentId,
          childId: parentChildLinks.childId,
        })
        .from(parentChildLinks)
        .where(eq(parentChildLinks.treeId, input.treeId));

      if (wouldCreateAncestorCycle(existingLinks, parentId, childId)) {
        return {
          ok: false as const,
          error: "Invalid link: this would create an ancestor loop in the family graph.",
        };
      }

      const parentRecord = await db.query.persons.findFirst({
        where: eq(persons.id, parentId),
      });
      const parentRole =
        parentRecord?.gender === "M"
          ? "father"
          : parentRecord?.gender === "F"
            ? "mother"
            : "parent";

      await db.insert(parentChildLinks).values({
        treeId: input.treeId,
        parentId,
        childId,
        lineageType: input.lineageType ?? "biological",
        parentRole,
      });
    }

    revalidatePath(`/trees/${tree.slug}`);
    return { ok: true as const };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Failed to link relatives.",
    };
  }
}

export async function deletePersonAction(input: {
  treeId: string;
  personId: string;
}) {
  try {
    const { tree } = await requireTreeEditor(input.treeId);
    await db
      .delete(persons)
      .where(
        and(eq(persons.id, input.personId), eq(persons.treeId, input.treeId)),
      );
    revalidatePath(`/trees/${tree.slug}`);
    return { ok: true as const };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Failed to delete person.",
    };
  }
}

export async function addLifeEventAction(input: {
  treeId: string;
  personId: string;
  eventType: LifeEventType;
  title: string;
  description?: string;
  dateText?: string;
  sortYear?: number | null;
  location?: string;
}) {
  try {
    const { tree } = await requireTreeEditor(input.treeId);
    const parsedYear =
      input.sortYear ??
      (input.dateText?.match(/(\d{4})/)
        ? Number.parseInt(input.dateText.match(/(\d{4})/)![1], 10)
        : null);

    await db.insert(lifeEvents).values({
      treeId: input.treeId,
      personId: input.personId,
      eventType: input.eventType,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      datePrecision: parsedYear ? "year" : "unknown",
      sortYear: parsedYear,
      dateText: input.dateText?.trim() || null,
      location: input.location?.trim() || null,
    });

    revalidatePath(`/trees/${tree.slug}`);
    return { ok: true as const };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Failed to add life event.",
    };
  }
}

export async function deleteLifeEventAction(input: {
  treeId: string;
  eventId: string;
}) {
  try {
    const { tree } = await requireTreeEditor(input.treeId);
    await db
      .delete(lifeEvents)
      .where(
        and(
          eq(lifeEvents.id, input.eventId),
          eq(lifeEvents.treeId, input.treeId),
        ),
      );
    revalidatePath(`/trees/${tree.slug}`);
    return { ok: true as const };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Failed to delete event.",
    };
  }
}

export async function removeParentChildLinkAction(input: {
  treeId: string;
  linkId: string;
}) {
  try {
    const { tree } = await requireTreeEditor(input.treeId);
    await db
      .delete(parentChildLinks)
      .where(
        and(
          eq(parentChildLinks.id, input.linkId),
          eq(parentChildLinks.treeId, input.treeId),
        ),
      );
    revalidatePath(`/trees/${tree.slug}`);
    return { ok: true as const };
  } catch (err) {
    return {
      ok: false as const,
      error:
        err instanceof Error ? err.message : "Failed to remove relationship.",
    };
  }
}

export async function updatePartnershipStatusAction(input: {
  treeId: string;
  partnershipId: string;
  status: PartnershipStatus;
}) {
  try {
    const { tree } = await requireTreeEditor(input.treeId);
    await db
      .update(partnerships)
      .set({ status: input.status })
      .where(
        and(
          eq(partnerships.id, input.partnershipId),
          eq(partnerships.treeId, input.treeId),
        ),
      );
    revalidatePath(`/trees/${tree.slug}`);
    return { ok: true as const };
  } catch (err) {
    return {
      ok: false as const,
      error:
        err instanceof Error
          ? err.message
          : "Failed to update marriage status.",
    };
  }
}

export async function removePartnershipAction(input: {
  treeId: string;
  partnershipId: string;
}) {
  try {
    const { tree } = await requireTreeEditor(input.treeId);
    await db
      .delete(partnerships)
      .where(
        and(
          eq(partnerships.id, input.partnershipId),
          eq(partnerships.treeId, input.treeId),
        ),
      );
    revalidatePath(`/trees/${tree.slug}`);
    return { ok: true as const };
  } catch (err) {
    return {
      ok: false as const,
      error:
        err instanceof Error ? err.message : "Failed to remove marriage link.",
    };
  }
}

export async function claimPersonProfileAction(input: {
  treeId: string;
  personId: string | null;
}) {
  try {
    const { user } = await requireUser();
    const tree = await db.query.familyTrees.findFirst({
      where: eq(familyTrees.id, input.treeId),
    });
    if (!tree) return { ok: false as const, error: "Tree not found." };

    await db
      .update(treeMembers)
      .set({ claimedPersonId: input.personId })
      .where(
        and(
          eq(treeMembers.treeId, input.treeId),
          eq(treeMembers.userId, user.id),
        ),
      );

    revalidatePath(`/trees/${tree.slug}`);
    revalidatePath("/trees");
    return { ok: true as const };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Failed to claim profile.",
    };
  }
}
