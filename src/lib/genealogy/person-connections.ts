import type { ParentChildLink, Partnership, Person } from "@/db/schema";

export interface PersonConnections {
  parents: Array<{
    linkId: string;
    person: Person;
    lineageType: ParentChildLink["lineageType"];
    role: ParentChildLink["parentRole"];
  }>;
  spouses: Array<{
    partnershipId: string;
    person: Person;
    status: Partnership["status"];
  }>;
  children: Array<{
    linkId: string;
    person: Person;
    lineageType: ParentChildLink["lineageType"];
  }>;
  siblings: Person[];
}

export function getPersonConnections(
  personId: string,
  allPersons: Person[],
  partnerships: Partnership[],
  parentChildLinks: ParentChildLink[],
): PersonConnections {
  const byId = new Map(allPersons.map((p) => [p.id, p]));

  const parentLinks = parentChildLinks.filter((l) => l.childId === personId);
  const parents = parentLinks
    .map((l) => ({
      linkId: l.id,
      person: byId.get(l.parentId),
      lineageType: l.lineageType,
      role: l.parentRole,
    }))
    .filter(
      (
        x,
      ): x is {
        linkId: string;
        person: Person;
        lineageType: ParentChildLink["lineageType"];
        role: ParentChildLink["parentRole"];
      } => Boolean(x.person),
    );

  const childLinks = parentChildLinks.filter((l) => l.parentId === personId);
  const children = childLinks
    .map((l) => ({
      linkId: l.id,
      person: byId.get(l.childId),
      lineageType: l.lineageType,
    }))
    .filter(
      (
        x,
      ): x is {
        linkId: string;
        person: Person;
        lineageType: ParentChildLink["lineageType"];
      } => Boolean(x.person),
    );

  const myUnions = partnerships.filter(
    (u) => u.partner1Id === personId || u.partner2Id === personId,
  );
  const spouses = myUnions
    .map((u) => {
      const partnerId =
        u.partner1Id === personId ? u.partner2Id : u.partner1Id;
      const p = byId.get(partnerId);
      return p ? { partnershipId: u.id, person: p, status: u.status } : null;
    })
    .filter(
      (
        x,
      ): x is {
        partnershipId: string;
        person: Person;
        status: Partnership["status"];
      } => Boolean(x),
    );

  const myParentIds = new Set(parentLinks.map((l) => l.parentId));
  const siblingIdSet = new Set<string>();
  for (const l of parentChildLinks) {
    if (myParentIds.has(l.parentId) && l.childId !== personId) {
      siblingIdSet.add(l.childId);
    }
  }
  const siblings = [...siblingIdSet]
    .map((id) => byId.get(id))
    .filter((x): x is Person => Boolean(x));

  return { parents, spouses, children, siblings };
}

export function getAgeSummary(person: Person): string | null {
  if (!person.birthYear) return null;
  const currentYear = new Date().getFullYear();
  if (person.isLiving) {
    const age = currentYear - person.birthYear;
    return age >= 0 && age <= 125 ? `Age ${age}` : null;
  }
  if (person.deathYear && person.deathYear >= person.birthYear) {
    return `Lived ${person.deathYear - person.birthYear} yrs`;
  }
  return null;
}
