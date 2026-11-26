import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  familyTrees,
  type Gender,
  lifeEvents,
  parentChildLinks,
  partnerships,
  persons,
  treeMembers,
} from "@/db/schema";

interface LegacyPersonRow {
  legacyId: number;
  rawName: string;
  gender: Gender;
  birthDate: string | null;
  deathDate: string | null;
  nationality: string | null;
  fatherLegacyId: number | null;
  motherLegacyId: number | null;
  childNo: number;
}

function parseSqlValue(token: string): string | null {
  const trimmed = token.trim();
  if (trimmed.toUpperCase() === "NULL") return null;
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed
      .slice(1, -1)
      .replace(/\\'/g, "'")
      .replace(/''/g, "'")
      .replace(/\\\\/g, "\\");
  }
  return trimmed;
}

function splitSqlTuple(tupleBody: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < tupleBody.length; i++) {
    const ch = tupleBody[i];
    if (ch === "'" && tupleBody[i - 1] !== "\\") {
      inQuotes = !inQuotes;
      current += ch;
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.length > 0) {
    fields.push(current.trim());
  }
  return fields;
}

export function parseLegacyPersonsFromSql(sqlContent: string): LegacyPersonRow[] {
  const blockMatch = sqlContent.match(
    /INSERT INTO `FamilyBranch_person` VALUES\s*([\s\S]*?);/,
  );
  if (!blockMatch?.[1]) {
    throw new Error(
      "Could not find `INSERT INTO FamilyBranch_person VALUES` in SQL file.",
    );
  }

  const block = blockMatch[1];
  const rows: LegacyPersonRow[] = [];
  const tupleRegex = /\(([^()\n]*(?:\([^()\n]*\)[^()\n]*)*)\)/g;

  for (const match of block.matchAll(tupleRegex)) {
    const fields = splitSqlTuple(match[1]);
    if (fields.length < 12) continue;

    const legacyId = Number.parseInt(fields[0], 10);
    const rawName = parseSqlValue(fields[1]) ?? "N/A";
    const rawGender = (parseSqlValue(fields[2]) ?? "U").toUpperCase();
    const gender: Gender =
      rawGender === "M" || rawGender === "F" ? rawGender : "U";
    const birthDate = parseSqlValue(fields[3]);
    const deathDate = parseSqlValue(fields[4]);
    const nationality = parseSqlValue(fields[5]);
    const fatherRaw = parseSqlValue(fields[8]);
    const motherRaw = parseSqlValue(fields[9]);
    const childNoRaw = parseSqlValue(fields[11]);

    rows.push({
      legacyId,
      rawName,
      gender,
      birthDate,
      deathDate,
      nationality,
      fatherLegacyId: fatherRaw ? Number.parseInt(fatherRaw, 10) : null,
      motherLegacyId: motherRaw ? Number.parseInt(motherRaw, 10) : null,
      childNo: childNoRaw ? Number.parseInt(childNoRaw, 10) : 0,
    });
  }

  return rows.sort((a, b) => a.legacyId - b.legacyId);
}

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function normalizeNameAndNickname(row: LegacyPersonRow): {
  displayName: string;
  fullName: string | null;
  nickname: string | null;
  isNameUnknown: boolean;
  placeholderLabel: string | null;
} {
  const trimmed = row.rawName.trim();

  // Case 1: Contains "N/A" -> unknown historical name
  if (/\bN\/A\b/i.test(trimmed)) {
    const cleanedHint = trimmed
      .replace(/\(?\bN\/A\b\)?/gi, "")
      .replace(/^\s*[-:]?\s*/, "")
      .replace(/^\((.*)\)$/, "$1")
      .replace(/\b([A-Za-z]+)s\s+(?=\d+(?:st|nd|rd|th)\b)/i, "$1's ")
      .trim();

    const genderWord =
      row.gender === "M" ? "Son" : row.gender === "F" ? "Daughter" : "Child";
    const fallbackLabel =
      row.childNo > 0
        ? `${ordinal(row.childNo)} ${genderWord}`
        : `Unnamed ${genderWord}`;
    const label = cleanedHint || fallbackLabel;

    return {
      displayName: label,
      fullName: null,
      nickname: null,
      isNameUnknown: true,
      placeholderLabel: label,
    };
  }

  // Case 2: Regular name with parenthetical nickname, e.g. "Ayesha (Sunny)"
  const nickMatch = trimmed.match(/^(.+?)\s*\(([^()]+)\)$/);
  if (nickMatch) {
    const mainName = nickMatch[1].trim();
    const nickname = nickMatch[2].trim();
    return {
      displayName: mainName,
      fullName: mainName,
      nickname,
      isNameUnknown: false,
      placeholderLabel: null,
    };
  }

  return {
    displayName: trimmed,
    fullName: trimmed,
    nickname: null,
    isNameUnknown: false,
    placeholderLabel: null,
  };
}

function computeGenerationDepths(rows: LegacyPersonRow[]): Map<number, number> {
  const byId = new Map(rows.map((r) => [r.legacyId, r]));
  const childrenOf = new Map<number, number[]>();
  const spousesOf = new Map<number, Set<number>>();

  for (const r of rows) {
    if (r.fatherLegacyId && byId.has(r.fatherLegacyId)) {
      const list = childrenOf.get(r.fatherLegacyId) ?? [];
      list.push(r.legacyId);
      childrenOf.set(r.fatherLegacyId, list);
    }
    if (r.motherLegacyId && byId.has(r.motherLegacyId)) {
      const list = childrenOf.get(r.motherLegacyId) ?? [];
      list.push(r.legacyId);
      childrenOf.set(r.motherLegacyId, list);
    }
    if (
      r.fatherLegacyId &&
      r.motherLegacyId &&
      byId.has(r.fatherLegacyId) &&
      byId.has(r.motherLegacyId)
    ) {
      if (!spousesOf.has(r.fatherLegacyId)) {
        spousesOf.set(r.fatherLegacyId, new Set());
      }
      if (!spousesOf.has(r.motherLegacyId)) {
        spousesOf.set(r.motherLegacyId, new Set());
      }
      spousesOf.get(r.fatherLegacyId)!.add(r.motherLegacyId);
      spousesOf.get(r.motherLegacyId)!.add(r.fatherLegacyId);
    }
  }

  const depth = new Map<number, number>();
  // Anchor earliest root ancestors (#1, #2) at generation 0
  for (const rootId of [1, 2]) {
    if (byId.has(rootId)) depth.set(rootId, 0);
  }

  // Relax parent-child (+1) and spouse (0) constraints iteratively so in-law roots
  // align cleanly across generations.
  let changed = true;
  let guard = 0;
  while (changed && guard < 40) {
    changed = false;
    guard++;

    for (const r of rows) {
      const pDepths: number[] = [];
      if (r.fatherLegacyId && depth.has(r.fatherLegacyId)) {
        pDepths.push(depth.get(r.fatherLegacyId)! + 1);
      }
      if (r.motherLegacyId && depth.has(r.motherLegacyId)) {
        pDepths.push(depth.get(r.motherLegacyId)! + 1);
      }
      if (pDepths.length > 0) {
        const nextDepth = Math.max(...pDepths);
        if (depth.get(r.legacyId) !== nextDepth) {
          depth.set(r.legacyId, nextDepth);
          changed = true;
        }
      }

      // Back-propagate from child to unanchored parent (in-law ancestors)
      if (depth.has(r.legacyId)) {
        const cDepth = depth.get(r.legacyId)!;
        for (const pId of [r.fatherLegacyId, r.motherLegacyId]) {
          if (pId && byId.has(pId) && !depth.has(pId)) {
            depth.set(pId, cDepth - 1);
            changed = true;
          }
        }
      }

      // Align spouses when one spouse has a known generation and the other doesn't
      if (depth.has(r.legacyId)) {
        const myDepth = depth.get(r.legacyId)!;
        for (const spId of spousesOf.get(r.legacyId) ?? []) {
          if (!depth.has(spId)) {
            depth.set(spId, myDepth);
            changed = true;
          }
        }
      }
    }
  }

  for (const r of rows) {
    if (!depth.has(r.legacyId)) depth.set(r.legacyId, 0);
  }

  return depth;
}

export interface ImportLegacyTreeOptions {
  ownerUserId: string;
  sqlFilePath?: string;
  treeName?: string;
  slugPrefix?: string;
}

export async function importLegacyFamilyTree({
  ownerUserId,
  sqlFilePath = path.join(process.cwd(), "docs", "db.sql"),
  treeName = "Legacy Family Tree",
  slugPrefix = "legacy-family-tree",
}: ImportLegacyTreeOptions) {
  const sqlContent = await fs.readFile(
    /* turbopackIgnore: true */ sqlFilePath,
    "utf8",
  );
  const legacyRows = parseLegacyPersonsFromSql(sqlContent);
  if (legacyRows.length === 0) {
    throw new Error("No person records parsed from legacy SQL dump.");
  }

  const depths = computeGenerationDepths(legacyRows);

  // Detect siblings sharing identical positive child_no under the same parents (twins/co-ranked)
  const parentGroupCounts = new Map<string, number>();
  for (const r of legacyRows) {
    if (r.childNo > 0 && (r.fatherLegacyId || r.motherLegacyId)) {
      const key = `${r.fatherLegacyId ?? 0}:${r.motherLegacyId ?? 0}:${r.childNo}`;
      parentGroupCounts.set(key, (parentGroupCounts.get(key) ?? 0) + 1);
    }
  }

  // Ensure unique slug
  let slug = slugPrefix;
  const existing = await db.query.familyTrees.findFirst({
    where: eq(familyTrees.slug, slug),
  });
  if (existing) {
    slug = `${slugPrefix}-${crypto.randomBytes(3).toString("hex")}`;
  }

  return db.transaction(async (tx) => {
    const [tree] = await tx
      .insert(familyTrees)
      .values({
        name: treeName,
        slug,
        description:
          "Multi-generation family tree imported from legacy SQL dump.",
        createdById: ownerUserId,
      })
      .returning();

    const uuidByLegacyId = new Map<number, string>();
    for (const r of legacyRows) {
      uuidByLegacyId.set(r.legacyId, crypto.randomUUID());
    }

    const personInserts = legacyRows.map((r) => {
      const normalized = normalizeNameAndNickname(r);
      const gen = depths.get(r.legacyId) ?? 0;
      const twinKey = `${r.fatherLegacyId ?? 0}:${r.motherLegacyId ?? 0}:${r.childNo}`;
      const isTwin =
        r.childNo > 0 && (parentGroupCounts.get(twinKey) ?? 0) > 1;

      const birthYear = r.birthDate
        ? Number.parseInt(r.birthDate.slice(0, 4), 10)
        : null;
      const deathYear = r.deathDate
        ? Number.parseInt(r.deathDate.slice(0, 4), 10)
        : null;

      // Generations >= 5 (parents & current youth generations) default to living unless deathDate is present
      const isLiving = r.deathDate ? false : gen >= 5;

      return {
        id: uuidByLegacyId.get(r.legacyId)!,
        treeId: tree.id,
        legacyId: r.legacyId,
        displayName: normalized.displayName,
        fullName: normalized.fullName,
        nickname: normalized.nickname,
        isNameUnknown: normalized.isNameUnknown,
        placeholderLabel: normalized.placeholderLabel,
        gender: r.gender,
        isLiving,
        birthDatePrecision: (r.birthDate ? "exact" : "unknown") as
          | "exact"
          | "unknown",
        birthDate: r.birthDate,
        birthYear,
        birthDateText: r.birthDate,
        deathDatePrecision: (r.deathDate ? "exact" : "unknown") as
          | "exact"
          | "unknown",
        deathDate: r.deathDate,
        deathYear,
        deathDateText: r.deathDate,
        nationality: r.nationality ?? "Bangladeshi",
        currentCountry: r.nationality === "Bangladeshi" ? "Bangladesh" : null,
        siblingOrder: r.childNo > 0 ? r.childNo : 0,
        isTwin,
        createdById: ownerUserId,
      };
    });

    await tx.insert(persons).values(personInserts);

    // Infer explicit Partnership records for every unique (fatherLegacyId, motherLegacyId) pair
    const partnershipByPairKey = new Map<string, string>();
    const partnershipInserts: Array<typeof partnerships.$inferInsert> = [];

    for (const r of legacyRows) {
      if (
        r.fatherLegacyId &&
        r.motherLegacyId &&
        uuidByLegacyId.has(r.fatherLegacyId) &&
        uuidByLegacyId.has(r.motherLegacyId)
      ) {
        const pairKey = `${r.fatherLegacyId}:${r.motherLegacyId}`;
        if (!partnershipByPairKey.has(pairKey)) {
          const unionId = crypto.randomUUID();
          partnershipByPairKey.set(pairKey, unionId);
          partnershipInserts.push({
            id: unionId,
            treeId: tree.id,
            partner1Id: uuidByLegacyId.get(r.fatherLegacyId)!,
            partner2Id: uuidByLegacyId.get(r.motherLegacyId)!,
            status: "married",
            marriageOrder: 1,
          });
        }
      }
    }

    if (partnershipInserts.length > 0) {
      await tx.insert(partnerships).values(partnershipInserts);
    }

    // Create Parent-Child Links
    const linkInserts: Array<typeof parentChildLinks.$inferInsert> = [];
    for (const r of legacyRows) {
      const childUuid = uuidByLegacyId.get(r.legacyId)!;
      const pairKey =
        r.fatherLegacyId && r.motherLegacyId
          ? `${r.fatherLegacyId}:${r.motherLegacyId}`
          : null;
      const partnershipId = pairKey
        ? (partnershipByPairKey.get(pairKey) ?? null)
        : null;

      if (r.fatherLegacyId && uuidByLegacyId.has(r.fatherLegacyId)) {
        linkInserts.push({
          treeId: tree.id,
          parentId: uuidByLegacyId.get(r.fatherLegacyId)!,
          childId: childUuid,
          partnershipId,
          lineageType: "biological",
          parentRole: "father",
        });
      }

      if (r.motherLegacyId && uuidByLegacyId.has(r.motherLegacyId)) {
        linkInserts.push({
          treeId: tree.id,
          parentId: uuidByLegacyId.get(r.motherLegacyId)!,
          childId: childUuid,
          partnershipId,
          lineageType: "biological",
          parentRole: "mother",
        });
      }
    }

    if (linkInserts.length > 0) {
      await tx.insert(parentChildLinks).values(linkInserts);
    }

    // Seed birth life_events for members with known birth dates
    const eventInserts = legacyRows
      .filter((r) => Boolean(r.birthDate))
      .map((r) => ({
        treeId: tree.id,
        personId: uuidByLegacyId.get(r.legacyId)!,
        eventType: "birth" as const,
        title: "Born",
        datePrecision: "exact" as const,
        eventDate: r.birthDate!,
        sortYear: Number.parseInt(r.birthDate!.slice(0, 4), 10),
        dateText: r.birthDate!,
        location: "Bangladesh",
      }));

    if (eventInserts.length > 0) {
      await tx.insert(lifeEvents).values(eventInserts);
    }

    const rootPersonId = uuidByLegacyId.get(1) ?? null;
    const claimedPersonId = null;

    if (rootPersonId) {
      await tx
        .update(familyTrees)
        .set({ rootPersonId })
        .where(eq(familyTrees.id, tree.id));
    }

    await tx.insert(treeMembers).values({
      treeId: tree.id,
      userId: ownerUserId,
      role: "owner",
      claimedPersonId,
    });

    return {
      treeId: tree.id,
      slug: tree.slug,
      personsCount: personInserts.length,
      partnershipsCount: partnershipInserts.length,
      linksCount: linkInserts.length,
    };
  });
}

export async function hasUserImportedLegacyTree(userId: string) {
  const existing = await db
    .select({ id: familyTrees.id })
    .from(familyTrees)
    .innerJoin(
      treeMembers,
      and(
        eq(treeMembers.treeId, familyTrees.id),
        eq(treeMembers.userId, userId),
      ),
    )
    .limit(1);
  return existing.length > 0;
}
