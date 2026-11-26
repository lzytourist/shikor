import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { and, eq, inArray, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import { persons, treeMembers, user } from "@/db/schema";
import { getCurrentSession } from "@/server/dal/auth";

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB
const ALLOWED_TYPES = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const target = String(formData.get("target") ?? "person");
  const treeId = String(formData.get("treeId") ?? "");
  const personId = String(formData.get("personId") ?? "");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing image file." }, { status: 400 });
  }

  const ext = ALLOWED_TYPES.get(file.type);
  if (!ext) {
    return NextResponse.json(
      { error: "Only JPG, PNG, WEBP, or GIF images are allowed." },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Image size must be 4 MB or smaller." },
      { status: 400 },
    );
  }

  if (target === "user") {
    const syncToLinked = formData.get("syncToLinked") !== "false";
    const bytes = Buffer.from(await file.arrayBuffer());
    const fileName = `user-${session.user.id}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
    const uploadDir = path.join(
      /* turbopackIgnore: true */ process.cwd(),
      "public",
      "uploads",
      "avatars",
    );
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(path.join(uploadDir, fileName), bytes);

    const avatarUrl = `/uploads/avatars/${fileName}`;

    await db
      .update(user)
      .set({ image: avatarUrl })
      .where(eq(user.id, session.user.id));

    if (syncToLinked) {
      const linked = await db
        .select({ personId: treeMembers.claimedPersonId })
        .from(treeMembers)
        .where(
          and(
            eq(treeMembers.userId, session.user.id),
            isNotNull(treeMembers.claimedPersonId),
          ),
        );
      const personIds = linked
        .map((r) => r.personId)
        .filter((id): id is string => Boolean(id));
      if (personIds.length > 0) {
        await db
          .update(persons)
          .set({ avatarUrl })
          .where(inArray(persons.id, personIds));
      }
    }

    return NextResponse.json({ avatarUrl });
  }

  if (!treeId || !personId) {
    return NextResponse.json(
      { error: "Missing treeId or personId." },
      { status: 400 },
    );
  }

  const membership = await db.query.treeMembers.findFirst({
    where: and(
      eq(treeMembers.treeId, treeId),
      eq(treeMembers.userId, session.user.id),
    ),
  });

  if (
    !membership ||
    (membership.role !== "owner" && membership.role !== "editor")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const fileName = `${personId}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  const uploadDir = path.join(
    /* turbopackIgnore: true */ process.cwd(),
    "public",
    "uploads",
    "avatars",
  );
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, fileName), bytes);

  const avatarUrl = `/uploads/avatars/${fileName}`;

  await db
    .update(persons)
    .set({ avatarUrl })
    .where(and(eq(persons.id, personId), eq(persons.treeId, treeId)));

  return NextResponse.json({ avatarUrl });
}
