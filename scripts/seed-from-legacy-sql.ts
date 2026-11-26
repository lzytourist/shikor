import "dotenv/config";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";

import { db, pool } from "../src/db";
import { familyTrees, treeMembers, user } from "../src/db/schema";
import { importLegacyFamilyTree } from "../src/server/importers/legacy-sql";

async function main() {
  const targetEmail =
    process.env.SEED_OWNER_EMAIL?.trim() || "john@mail.app";

  // Prefer an existing user matching SEED_OWNER_EMAIL, or the first signed-up user in DB
  let owner = await db.query.user.findFirst({
    where: eq(user.email, targetEmail),
  });

  if (!owner) {
    owner = await db.query.user.findFirst();
  }

  if (!owner) {
    const [created] = await db
      .insert(user)
      .values({
        id: crypto.randomUUID(),
        name: process.env.SEED_OWNER_NAME?.trim() || "John Doe",
        email: targetEmail,
        emailVerified: true,
      })
      .returning();
    owner = created;
    console.log(
      `Created verified owner profile for ${owner.email} (Google OAuth will auto-link on sign-in).`,
    );
  }

  // Idempotency check: skip if legacy-family-tree already exists for this user
  const existingTree = await db.query.familyTrees.findFirst({
    where: eq(familyTrees.slug, "legacy-family-tree"),
  });

  if (existingTree) {
    const existingMember = await db.query.treeMembers.findFirst({
      where: eq(treeMembers.treeId, existingTree.id),
    });
    console.log(
      `Legacy Family Tree already seeded (slug: ${existingTree.slug}, ownerId: ${existingMember?.userId}).`,
    );
    await pool.end();
    return;
  }

  const result = await importLegacyFamilyTree({
    ownerUserId: owner.id,
  });

  console.log("Successfully seeded Legacy Family Tree from docs/db.sql:", result);
  await pool.end();
}

main().catch((err) => {
  console.error("Failed to seed legacy SQL:", err);
  process.exit(1);
});
