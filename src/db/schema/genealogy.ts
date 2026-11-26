import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export type TreeRole = "owner" | "editor" | "viewer";
export type Gender = "M" | "F" | "O" | "U";
export type DatePrecision = "exact" | "year" | "month" | "approx" | "unknown";
export type BloodGroup =
  | "A+"
  | "A-"
  | "B+"
  | "B-"
  | "AB+"
  | "AB-"
  | "O+"
  | "O-";
export type PartnershipStatus =
  | "married"
  | "divorced"
  | "widowed"
  | "separated"
  | "engaged";
export type LineageType = "biological" | "adoptive" | "step" | "foster";
export type ParentRole = "father" | "mother" | "parent";
export type LifeEventType =
  | "birth"
  | "marriage"
  | "education"
  | "career"
  | "migration"
  | "achievement"
  | "death"
  | "burial"
  | "custom";

export const familyTrees = pgTable(
  "family_trees",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    rootPersonId: uuid("root_person_id"),
    createdById: text("created_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("family_trees_created_by_idx").on(table.createdById)],
);

export const persons = pgTable(
  "persons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    treeId: uuid("tree_id")
      .notNull()
      .references(() => familyTrees.id, { onDelete: "cascade" }),
    legacyId: integer("legacy_id"),
    displayName: text("display_name").notNull(),
    fullName: text("full_name"),
    nickname: text("nickname"),
    nativeName: text("native_name"),
    isNameUnknown: boolean("is_name_unknown").default(false).notNull(),
    placeholderLabel: text("placeholder_label"),
    gender: text("gender").$type<Gender>().default("U").notNull(),
    isLiving: boolean("is_living").default(true).notNull(),

    birthDatePrecision: text("birth_date_precision")
      .$type<DatePrecision>()
      .default("unknown")
      .notNull(),
    birthDate: date("birth_date"),
    birthYear: integer("birth_year"),
    birthDateText: text("birth_date_text"),

    deathDatePrecision: text("death_date_precision")
      .$type<DatePrecision>()
      .default("unknown")
      .notNull(),
    deathDate: date("death_date"),
    deathYear: integer("death_year"),
    deathDateText: text("death_date_text"),

    bloodGroup: text("blood_group").$type<BloodGroup>(),
    occupation: text("occupation"),
    education: text("education"),
    bioMarkdown: text("bio_markdown"),
    nationality: text("nationality"),
    birthPlace: text("birth_place"),
    currentCity: text("current_city"),
    currentCountry: text("current_country"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    contactPhone: text("contact_phone"),
    contactEmail: text("contact_email"),
    avatarUrl: text("avatar_url"),

    siblingOrder: integer("sibling_order").default(0).notNull(),
    isTwin: boolean("is_twin").default(false).notNull(),

    createdById: text("created_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("persons_tree_id_idx").on(table.treeId),
    index("persons_tree_legacy_idx").on(table.treeId, table.legacyId),
  ],
);

export const treeMembers = pgTable(
  "tree_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    treeId: uuid("tree_id")
      .notNull()
      .references(() => familyTrees.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").$type<TreeRole>().default("viewer").notNull(),
    claimedPersonId: uuid("claimed_person_id").references(() => persons.id, {
      onDelete: "set null",
    }),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("tree_members_tree_user_uniq").on(table.treeId, table.userId),
    index("tree_members_user_id_idx").on(table.userId),
  ],
);

export const treeShareLinks = pgTable(
  "tree_share_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    treeId: uuid("tree_id")
      .notNull()
      .references(() => familyTrees.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    label: text("label").notNull(),
    passcodeHash: text("passcode_hash").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    expiresAt: timestamp("expires_at"),
    lastAccessedAt: timestamp("last_accessed_at"),
    createdById: text("created_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("tree_share_links_tree_id_idx").on(table.treeId)],
);

export const partnerships = pgTable(
  "partnerships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    treeId: uuid("tree_id")
      .notNull()
      .references(() => familyTrees.id, { onDelete: "cascade" }),
    partner1Id: uuid("partner1_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    partner2Id: uuid("partner2_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    status: text("status")
      .$type<PartnershipStatus>()
      .default("married")
      .notNull(),
    marriageOrder: integer("marriage_order").default(1).notNull(),
    startDatePrecision: text("start_date_precision")
      .$type<DatePrecision>()
      .default("unknown")
      .notNull(),
    startDate: date("start_date"),
    startYear: integer("start_year"),
    startDateText: text("start_date_text"),
    endDateText: text("end_date_text"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("partnerships_tree_id_idx").on(table.treeId),
    index("partnerships_p1_idx").on(table.partner1Id),
    index("partnerships_p2_idx").on(table.partner2Id),
  ],
);

export const parentChildLinks = pgTable(
  "parent_child_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    treeId: uuid("tree_id")
      .notNull()
      .references(() => familyTrees.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    childId: uuid("child_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    partnershipId: uuid("partnership_id").references(() => partnerships.id, {
      onDelete: "set null",
    }),
    lineageType: text("lineage_type")
      .$type<LineageType>()
      .default("biological")
      .notNull(),
    parentRole: text("parent_role")
      .$type<ParentRole>()
      .default("parent")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("parent_child_links_parent_child_type_uniq").on(
      table.parentId,
      table.childId,
      table.lineageType,
    ),
    index("parent_child_links_tree_id_idx").on(table.treeId),
    index("parent_child_links_child_id_idx").on(table.childId),
    index("parent_child_links_parent_id_idx").on(table.parentId),
  ],
);

export const lifeEvents = pgTable(
  "life_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    treeId: uuid("tree_id")
      .notNull()
      .references(() => familyTrees.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    eventType: text("event_type")
      .$type<LifeEventType>()
      .default("custom")
      .notNull(),
    title: text("title").notNull(),
    description: text("description"),
    datePrecision: text("date_precision")
      .$type<DatePrecision>()
      .default("unknown")
      .notNull(),
    eventDate: date("event_date"),
    sortYear: integer("sort_year"),
    dateText: text("date_text"),
    location: text("location"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("life_events_tree_id_idx").on(table.treeId),
    index("life_events_person_id_idx").on(table.personId),
  ],
);

export const geocache = pgTable("geocache", {
  queryKey: text("query_key").primaryKey(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  displayLabel: text("display_label").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const familyTreesRelations = relations(familyTrees, ({ one, many }) => ({
  createdBy: one(user, {
    fields: [familyTrees.createdById],
    references: [user.id],
  }),
  members: many(treeMembers),
  shareLinks: many(treeShareLinks),
  persons: many(persons),
  partnerships: many(partnerships),
  parentChildLinks: many(parentChildLinks),
  lifeEvents: many(lifeEvents),
}));

export const treeMembersRelations = relations(treeMembers, ({ one }) => ({
  tree: one(familyTrees, {
    fields: [treeMembers.treeId],
    references: [familyTrees.id],
  }),
  user: one(user, {
    fields: [treeMembers.userId],
    references: [user.id],
  }),
  claimedPerson: one(persons, {
    fields: [treeMembers.claimedPersonId],
    references: [persons.id],
  }),
}));

export const treeShareLinksRelations = relations(treeShareLinks, ({ one }) => ({
  tree: one(familyTrees, {
    fields: [treeShareLinks.treeId],
    references: [familyTrees.id],
  }),
}));

export const personsRelations = relations(persons, ({ one, many }) => ({
  tree: one(familyTrees, {
    fields: [persons.treeId],
    references: [familyTrees.id],
  }),
  lifeEvents: many(lifeEvents),
}));

export const partnershipsRelations = relations(
  partnerships,
  ({ one, many }) => ({
    tree: one(familyTrees, {
      fields: [partnerships.treeId],
      references: [familyTrees.id],
    }),
    partner1: one(persons, {
      fields: [partnerships.partner1Id],
      references: [persons.id],
      relationName: "partner1",
    }),
    partner2: one(persons, {
      fields: [partnerships.partner2Id],
      references: [persons.id],
      relationName: "partner2",
    }),
    childLinks: many(parentChildLinks),
  }),
);

export const parentChildLinksRelations = relations(
  parentChildLinks,
  ({ one }) => ({
    tree: one(familyTrees, {
      fields: [parentChildLinks.treeId],
      references: [familyTrees.id],
    }),
    parent: one(persons, {
      fields: [parentChildLinks.parentId],
      references: [persons.id],
      relationName: "parent",
    }),
    child: one(persons, {
      fields: [parentChildLinks.childId],
      references: [persons.id],
      relationName: "child",
    }),
    partnership: one(partnerships, {
      fields: [parentChildLinks.partnershipId],
      references: [partnerships.id],
    }),
  }),
);

export const lifeEventsRelations = relations(lifeEvents, ({ one }) => ({
  tree: one(familyTrees, {
    fields: [lifeEvents.treeId],
    references: [familyTrees.id],
  }),
  person: one(persons, {
    fields: [lifeEvents.personId],
    references: [persons.id],
  }),
}));

export type FamilyTree = typeof familyTrees.$inferSelect;
export type Person = typeof persons.$inferSelect;
export type Partnership = typeof partnerships.$inferSelect;
export type ParentChildLink = typeof parentChildLinks.$inferSelect;
export type LifeEvent = typeof lifeEvents.$inferSelect;
export type TreeMember = typeof treeMembers.$inferSelect;
export type TreeShareLink = typeof treeShareLinks.$inferSelect;
