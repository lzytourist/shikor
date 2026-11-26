import type {
  Gender,
  LineageType,
  ParentChildLink,
  Partnership,
  Person,
} from "@/db/schema";

export type StepKind = "UP" | "DOWN" | "SPOUSE" | "SIBLING";

export interface KinshipStep {
  fromId: string;
  toId: string;
  kind: StepKind;
  targetGender: Gender;
  viaParentGender?: Gender;
  lineageType?: LineageType;
  isOlderThanFrom?: boolean | null;
}

export interface KinshipResult {
  englishTerm: string;
  bengaliTranslit?: string;
  bengaliScript?: string;
  badgeText: string;
  lineageNote?: string;
  pathPersonIds: string[];
  steps: KinshipStep[];
}

interface RawAdjEdge {
  toId: string;
  kind: "UP" | "DOWN" | "SPOUSE";
  lineageType?: LineageType;
}

function isTargetOlder(from: Person | undefined, to: Person | undefined): boolean | null {
  if (!from || !to) return null;
  if (from.birthYear && to.birthYear && from.birthYear !== to.birthYear) {
    return to.birthYear < from.birthYear;
  }
  if (
    from.siblingOrder > 0 &&
    to.siblingOrder > 0 &&
    from.siblingOrder !== to.siblingOrder
  ) {
    return to.siblingOrder < from.siblingOrder;
  }
  return null;
}

function compressSiblings(
  rawPath: Array<{ personId: string; viaEdge?: RawAdjEdge }>,
  personById: Map<string, Person>,
): KinshipStep[] {
  const rawSteps: KinshipStep[] = [];
  for (let i = 1; i < rawPath.length; i++) {
    const prev = rawPath[i - 1];
    const curr = rawPath[i];
    const edge = curr.viaEdge!;
    const target = personById.get(curr.personId);
    rawSteps.push({
      fromId: prev.personId,
      toId: curr.personId,
      kind: edge.kind,
      targetGender: target?.gender ?? "U",
      lineageType: edge.lineageType,
    });
  }

  // Compress UP -> DOWN into SIBLING
  const compressed: KinshipStep[] = [];
  let i = 0;
  while (i < rawSteps.length) {
    const s1 = rawSteps[i];
    const s2 = rawSteps[i + 1];
    if (s1 && s2 && s1.kind === "UP" && s2.kind === "DOWN") {
      const fromPerson = personById.get(s1.fromId);
      const toPerson = personById.get(s2.toId);
      compressed.push({
        fromId: s1.fromId,
        toId: s2.toId,
        kind: "SIBLING",
        targetGender: s2.targetGender,
        viaParentGender: s1.targetGender,
        lineageType:
          s1.lineageType === "biological" && s2.lineageType === "biological"
            ? "biological"
            : (s1.lineageType ?? s2.lineageType),
        isOlderThanFrom: isTargetOlder(fromPerson, toPerson),
      });
      i += 2;
    } else {
      compressed.push(s1);
      i += 1;
    }
  }
  return compressed;
}

function describeSteps(
  steps: KinshipStep[],
  sourceGender: Gender,
): {
  englishTerm: string;
  bengaliTranslit?: string;
  bengaliScript?: string;
} {
  if (steps.length === 0) {
    return {
      englishTerm: "Self (You)",
      bengaliTranslit: "Nije",
      bengaliScript: "নিজে",
    };
  }

  const sig = steps.map((s) => `${s.kind}:${s.targetGender}`).join("|");
  const lastGender = steps[steps.length - 1].targetGender;
  const isMale = lastGender === "M";
  const isFemale = lastGender === "F";

  // 1-step relations
  if (steps.length === 1) {
    const s = steps[0];
    if (s.kind === "UP") {
      if (isMale) return { englishTerm: "Father", bengaliTranslit: "Baba", bengaliScript: "বাবা" };
      if (isFemale) return { englishTerm: "Mother", bengaliTranslit: "Ma", bengaliScript: "মা" };
      return { englishTerm: "Parent" };
    }
    if (s.kind === "DOWN") {
      if (isMale) return { englishTerm: "Son", bengaliTranslit: "Chele", bengaliScript: "ছেলে" };
      if (isFemale) return { englishTerm: "Daughter", bengaliTranslit: "Meye", bengaliScript: "মেয়ে" };
      return { englishTerm: "Child" };
    }
    if (s.kind === "SPOUSE") {
      if (isMale) return { englishTerm: "Husband", bengaliTranslit: "Swami", bengaliScript: "স্বামী" };
      if (isFemale) return { englishTerm: "Wife", bengaliTranslit: "Stri", bengaliScript: "স্ত্রী" };
      return { englishTerm: "Spouse" };
    }
    if (s.kind === "SIBLING") {
      if (isMale) {
        if (s.isOlderThanFrom === true) {
          return { englishTerm: "Elder Brother", bengaliTranslit: "Boro Bhai", bengaliScript: "বড় ভাই" };
        }
        return { englishTerm: "Brother", bengaliTranslit: "Bhai", bengaliScript: "ভাই" };
      }
      if (isFemale) {
        if (s.isOlderThanFrom === true) {
          return { englishTerm: "Elder Sister", bengaliTranslit: "Apa / Boro Bon", bengaliScript: "আপু / বড় বোন" };
        }
        return { englishTerm: "Sister", bengaliTranslit: "Bon", bengaliScript: "বোন" };
      }
      return { englishTerm: "Sibling" };
    }
  }

  // 2-step relations
  if (steps.length === 2) {
    const [a, b] = steps;

    // Grandparents: UP -> UP
    if (a.kind === "UP" && b.kind === "UP") {
      if (a.targetGender === "M") {
        if (isMale) return { englishTerm: "Paternal Grandfather", bengaliTranslit: "Dada", bengaliScript: "দাদা" };
        if (isFemale) return { englishTerm: "Paternal Grandmother", bengaliTranslit: "Dadi", bengaliScript: "দাদী" };
      }
      if (a.targetGender === "F") {
        if (isMale) return { englishTerm: "Maternal Grandfather", bengaliTranslit: "Nana", bengaliScript: "নানা" };
        if (isFemale) return { englishTerm: "Maternal Grandmother", bengaliTranslit: "Nani", bengaliScript: "নানী" };
      }
      return { englishTerm: isMale ? "Grandfather" : isFemale ? "Grandmother" : "Grandparent" };
    }

    // Grandchildren: DOWN -> DOWN
    if (a.kind === "DOWN" && b.kind === "DOWN") {
      if (isMale) return { englishTerm: "Grandson", bengaliTranslit: "Nati", bengaliScript: "নাতি" };
      if (isFemale) return { englishTerm: "Granddaughter", bengaliTranslit: "Natni", bengaliScript: "নাতনি" };
      return { englishTerm: "Grandchild" };
    }

    // Uncles & Aunts (blood): UP -> SIBLING
    if (a.kind === "UP" && b.kind === "SIBLING") {
      if (a.targetGender === "M") {
        if (isMale) {
          if (b.isOlderThanFrom === true) {
            return { englishTerm: "Paternal Uncle (Father's Elder Brother)", bengaliTranslit: "Jetha", bengaliScript: "জেঠা" };
          }
          return { englishTerm: "Paternal Uncle", bengaliTranslit: "Chacha", bengaliScript: "চাচা" };
        }
        if (isFemale) {
          return { englishTerm: "Paternal Aunt", bengaliTranslit: "Fupu", bengaliScript: "ফুপু" };
        }
      }
      if (a.targetGender === "F") {
        if (isMale) return { englishTerm: "Maternal Uncle", bengaliTranslit: "Mama", bengaliScript: "মামা" };
        if (isFemale) return { englishTerm: "Maternal Aunt", bengaliTranslit: "Khala", bengaliScript: "খালা" };
      }
      return { englishTerm: isMale ? "Uncle" : isFemale ? "Aunt" : "Parent's Sibling" };
    }

    // Nieces & Nephews: SIBLING -> DOWN
    if (a.kind === "SIBLING" && b.kind === "DOWN") {
      const sameSide =
        (sourceGender === "M" && a.targetGender === "M") ||
        (sourceGender === "F" && a.targetGender === "M");
      if (a.targetGender === "M" || sameSide) {
        if (isMale) return { englishTerm: "Brother's Son (Nephew)", bengaliTranslit: "Bhatija", bengaliScript: "ভাতিজা" };
        if (isFemale) return { englishTerm: "Brother's Daughter (Niece)", bengaliTranslit: "Bhatiji", bengaliScript: "ভাতিজি" };
      }
      if (a.targetGender === "F") {
        if (isMale) return { englishTerm: "Sister's Son (Nephew)", bengaliTranslit: "Bhagina", bengaliScript: "ভাগিনা" };
        if (isFemale) return { englishTerm: "Sister's Daughter (Niece)", bengaliTranslit: "Bhagni", bengaliScript: "ভাগ্নি" };
      }
      return { englishTerm: isMale ? "Nephew" : isFemale ? "Niece" : "Nibling" };
    }

    // Sibling's spouse: SIBLING -> SPOUSE
    if (a.kind === "SIBLING" && b.kind === "SPOUSE") {
      if (a.targetGender === "M" && isFemale) {
        return { englishTerm: "Sister-in-law (Brother's Wife)", bengaliTranslit: "Bhabi", bengaliScript: "ভাবী" };
      }
      if (a.targetGender === "F" && isMale) {
        return { englishTerm: "Brother-in-law (Sister's Husband)", bengaliTranslit: "Dulabhai", bengaliScript: "দুলাভাই" };
      }
      return { englishTerm: isMale ? "Brother-in-law" : "Sister-in-law" };
    }

    // Spouse's parents: SPOUSE -> UP
    if (a.kind === "SPOUSE" && b.kind === "UP") {
      if (isMale) return { englishTerm: "Father-in-law", bengaliTranslit: "Shoshur", bengaliScript: "শ্বশুর" };
      if (isFemale) return { englishTerm: "Mother-in-law", bengaliTranslit: "Shashuri", bengaliScript: "শাশুড়ি" };
      return { englishTerm: "Parent-in-law" };
    }

    // Spouse's siblings: SPOUSE -> SIBLING
    if (a.kind === "SPOUSE" && b.kind === "SIBLING") {
      if (a.targetGender === "F") {
        if (isMale) return { englishTerm: "Brother-in-law (Wife's Brother)", bengaliTranslit: "Shala", bengaliScript: "শালা" };
        if (isFemale) return { englishTerm: "Sister-in-law (Wife's Sister)", bengaliTranslit: "Shali", bengaliScript: "শালী" };
      }
      if (a.targetGender === "M") {
        if (isMale) return { englishTerm: "Brother-in-law (Husband's Brother)", bengaliTranslit: "Debor / Bhashur", bengaliScript: "দেবর / ভাসুর" };
        if (isFemale) return { englishTerm: "Sister-in-law (Husband's Sister)", bengaliTranslit: "Nanod", bengaliScript: "ননদ" };
      }
      return { englishTerm: isMale ? "Brother-in-law" : "Sister-in-law" };
    }

    // Child's spouse: DOWN -> SPOUSE
    if (a.kind === "DOWN" && b.kind === "SPOUSE") {
      if (isMale) return { englishTerm: "Son-in-law", bengaliTranslit: "Jamai", bengaliScript: "জামাই" };
      if (isFemale) return { englishTerm: "Daughter-in-law", bengaliTranslit: "Bouma", bengaliScript: "বউমা" };
      return { englishTerm: "Child-in-law" };
    }
  }

  // 3-step relations
  if (steps.length === 3) {
    const [a, b, c] = steps;

    // First Cousins: UP -> SIBLING -> DOWN
    if (a.kind === "UP" && b.kind === "SIBLING" && c.kind === "DOWN") {
      const cousinGenderEn = isMale ? "Male" : isFemale ? "Female" : "";
      const bhaiBon = isMale ? "Bhai" : isFemale ? "Bon" : "Cousin";
      const bhaiBonBn = isMale ? "ভাই" : isFemale ? "বোন" : "কাজিন";

      if (a.targetGender === "M" && b.targetGender === "M") {
        return {
          englishTerm: `Paternal First Cousin${cousinGenderEn ? ` (${cousinGenderEn})` : ""}`,
          bengaliTranslit: `Chachato ${bhaiBon}`,
          bengaliScript: `চাচাতো ${bhaiBonBn}`,
        };
      }
      if (a.targetGender === "M" && b.targetGender === "F") {
        return {
          englishTerm: `Paternal Aunt's Child — First Cousin${cousinGenderEn ? ` (${cousinGenderEn})` : ""}`,
          bengaliTranslit: `Fupato ${bhaiBon}`,
          bengaliScript: `ফুপাতো ${bhaiBonBn}`,
        };
      }
      if (a.targetGender === "F" && b.targetGender === "M") {
        return {
          englishTerm: `Maternal Uncle's Child — First Cousin${cousinGenderEn ? ` (${cousinGenderEn})` : ""}`,
          bengaliTranslit: `Mamato ${bhaiBon}`,
          bengaliScript: `মামাতো ${bhaiBonBn}`,
        };
      }
      if (a.targetGender === "F" && b.targetGender === "F") {
        return {
          englishTerm: `Maternal Aunt's Child — First Cousin${cousinGenderEn ? ` (${cousinGenderEn})` : ""}`,
          bengaliTranslit: `Khalato ${bhaiBon}`,
          bengaliScript: `খালাতো ${bhaiBonBn}`,
        };
      }
      return { englishTerm: "First Cousin" };
    }

    // Aunt/Uncle by marriage: UP -> SIBLING -> SPOUSE
    if (a.kind === "UP" && b.kind === "SIBLING" && c.kind === "SPOUSE") {
      if (a.targetGender === "M" && b.targetGender === "M" && isFemale) {
        return { englishTerm: "Paternal Aunt (Uncle's Wife)", bengaliTranslit: "Chachi / Jethi", bengaliScript: "চাচী / জেঠী" };
      }
      if (a.targetGender === "M" && b.targetGender === "F" && isMale) {
        return { englishTerm: "Paternal Uncle (Aunt's Husband)", bengaliTranslit: "Fupa", bengaliScript: "ফুপা" };
      }
      if (a.targetGender === "F" && b.targetGender === "M" && isFemale) {
        return { englishTerm: "Maternal Aunt (Uncle's Wife)", bengaliTranslit: "Mami", bengaliScript: "মামী" };
      }
      if (a.targetGender === "F" && b.targetGender === "F" && isMale) {
        return { englishTerm: "Maternal Uncle (Aunt's Husband)", bengaliTranslit: "Khalu", bengaliScript: "খালু" };
      }
      return { englishTerm: isMale ? "Uncle (by marriage)" : "Aunt (by marriage)" };
    }
  }

  // Pure direct ancestors (Great-grandparents+)
  if (steps.every((s) => s.kind === "UP")) {
    const greats = steps.length - 2;
    const prefix = greats === 1 ? "Great-" : `${greats}x Great-`;
    const base = isMale ? "Grandfather" : isFemale ? "Grandmother" : "Ancestor";
    return {
      englishTerm: `${prefix}${base}`,
      bengaliTranslit: greats === 1 ? (isMale ? "Pordada / Boro Dada" : "Pordadi / Boro Dadi") : "Purbo Purush",
      bengaliScript: greats === 1 ? (isMale ? "পরদাদা" : "পরদাদী") : "পূর্বপুরুষ",
    };
  }

  // Pure direct descendants (Great-grandchildren+)
  if (steps.every((s) => s.kind === "DOWN")) {
    const greats = steps.length - 2;
    const prefix = greats === 1 ? "Great-" : `${greats}x Great-`;
    const base = isMale ? "Grandson" : isFemale ? "Granddaughter" : "Descendant";
    return {
      englishTerm: `${prefix}${base}`,
      bengaliTranslit: "Puti / Natir Sontan",
      bengaliScript: "পুতি / বংশধর",
    };
  }

  // Generic cousin / extended collateral calculation (N ups, SIBLING, M downs)
  const siblingIndex = steps.findIndex((s) => s.kind === "SIBLING");
  if (
    siblingIndex >= 0 &&
    steps.slice(0, siblingIndex).every((s) => s.kind === "UP") &&
    steps.slice(siblingIndex + 1).every((s) => s.kind === "DOWN")
  ) {
    const ups = siblingIndex;
    const downs = steps.length - siblingIndex - 1;
    if (ups >= 1 && downs >= 1) {
      const degree = Math.min(ups, downs);
      const removed = Math.abs(ups - downs);
      const degreeStr =
        degree === 1 ? "1st" : degree === 2 ? "2nd" : degree === 3 ? "3rd" : `${degree}th`;
      const removedStr =
        removed === 0
          ? ""
          : removed === 1
            ? " once removed"
            : removed === 2
              ? " twice removed"
              : ` ${removed}x removed`;
      return {
        englishTerm: `${degreeStr} Cousin${removedStr}`,
        bengaliTranslit: isMale ? "Durotto Bhai (Cousin)" : isFemale ? "Durotto Bon (Cousin)" : "Atmiyo",
        bengaliScript: isMale ? "জ্ঞাতি ভাই" : isFemale ? "জ্ঞাতি বোন" : "আত্মীয়",
      };
    }
    if (ups >= 2 && downs === 0) {
      const greats = ups - 1;
      const prefix = greats === 1 ? "Grand-" : `${greats - 1}x Great-Grand-`;
      return {
        englishTerm: `${prefix}${isMale ? "Uncle" : isFemale ? "Aunt" : "pibling"}`,
        bengaliTranslit: isMale ? "Dada / Nana" : "Dadi / Nani",
        bengaliScript: isMale ? "দাদা / নানা" : "দাদী / নানী",
      };
    }
    if (ups === 0 && downs >= 2) {
      const greats = downs - 1;
      const prefix = greats === 1 ? "Grand-" : `${greats - 1}x Great-Grand-`;
      return {
        englishTerm: `${prefix}${isMale ? "Nephew" : isFemale ? "Niece" : "Nibling"}`,
        bengaliTranslit: isMale ? "Nati" : "Natni",
        bengaliScript: isMale ? "নাতি" : "নাতনি",
      };
    }
  }

  void sig;
  return {
    englishTerm: `Extended Relative (${steps.length} steps)`,
    bengaliTranslit: "Atmiyo",
    bengaliScript: "আত্মীয়",
  };
}

export function calculateKinship(params: {
  sourcePersonId: string;
  targetPersonId: string;
  persons: Person[];
  partnerships: Partnership[];
  parentChildLinks: ParentChildLink[];
}): KinshipResult | null {
  const { sourcePersonId, targetPersonId, persons, partnerships, parentChildLinks } =
    params;

  const personById = new Map(persons.map((p) => [p.id, p]));
  const source = personById.get(sourcePersonId);
  const target = personById.get(targetPersonId);
  if (!source || !target) return null;

  if (sourcePersonId === targetPersonId) {
    return {
      englishTerm: "Self (You)",
      bengaliTranslit: "Nije",
      bengaliScript: "নিজে",
      badgeText: "You · নিজে",
      pathPersonIds: [sourcePersonId],
      steps: [],
    };
  }

  // Build adjacency list (prioritizing blood edges UP/DOWN before SPOUSE so blood kinship wins ties)
  const adj = new Map<string, RawAdjEdge[]>();
  const addEdge = (from: string, edge: RawAdjEdge) => {
    const list = adj.get(from) ?? [];
    list.push(edge);
    adj.set(from, list);
  };

  for (const link of parentChildLinks) {
    addEdge(link.childId, {
      toId: link.parentId,
      kind: "UP",
      lineageType: link.lineageType,
    });
    addEdge(link.parentId, {
      toId: link.childId,
      kind: "DOWN",
      lineageType: link.lineageType,
    });
  }

  for (const union of partnerships) {
    addEdge(union.partner1Id, { toId: union.partner2Id, kind: "SPOUSE" });
    addEdge(union.partner2Id, { toId: union.partner1Id, kind: "SPOUSE" });
  }

  // BFS shortest path
  const visited = new Set<string>([sourcePersonId]);
  const parentTrace = new Map<
    string,
    { prevId: string; viaEdge: RawAdjEdge }
  >();
  const queue: string[] = [sourcePersonId];
  let found = false;

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === targetPersonId) {
      found = true;
      break;
    }

    for (const edge of adj.get(current) ?? []) {
      if (!visited.has(edge.toId)) {
        visited.add(edge.toId);
        parentTrace.set(edge.toId, { prevId: current, viaEdge: edge });
        queue.push(edge.toId);
      }
    }
  }

  if (!found) return null;

  const rawPath: Array<{ personId: string; viaEdge?: RawAdjEdge }> = [];
  let cursor: string | undefined = targetPersonId;
  while (cursor) {
    const trace = parentTrace.get(cursor);
    rawPath.push({ personId: cursor, viaEdge: trace?.viaEdge });
    cursor = trace?.prevId;
  }
  rawPath.reverse();

  const steps = compressSiblings(rawPath, personById);
  const described = describeSteps(steps, source.gender);

  const nonBioSteps = steps.filter(
    (s) => s.lineageType && s.lineageType !== "biological",
  );
  const lineageNote =
    nonBioSteps.length > 0
      ? `Includes ${nonBioSteps[0].lineageType} lineage`
      : undefined;

  const badgeText = described.bengaliTranslit
    ? `${described.bengaliTranslit}${described.bengaliScript ? ` · ${described.bengaliScript}` : ""}`
    : described.englishTerm;

  return {
    ...described,
    badgeText,
    lineageNote,
    pathPersonIds: rawPath.map((p) => p.personId),
    steps,
  };
}
