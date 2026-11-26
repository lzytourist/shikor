CREATE TABLE "family_trees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"root_person_id" uuid,
	"created_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "family_trees_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "geocache" (
	"query_key" text PRIMARY KEY NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"display_label" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "life_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tree_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"event_type" text DEFAULT 'custom' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"date_precision" text DEFAULT 'unknown' NOT NULL,
	"event_date" date,
	"sort_year" integer,
	"date_text" text,
	"location" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parent_child_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tree_id" uuid NOT NULL,
	"parent_id" uuid NOT NULL,
	"child_id" uuid NOT NULL,
	"partnership_id" uuid,
	"lineage_type" text DEFAULT 'biological' NOT NULL,
	"parent_role" text DEFAULT 'parent' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partnerships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tree_id" uuid NOT NULL,
	"partner1_id" uuid NOT NULL,
	"partner2_id" uuid NOT NULL,
	"status" text DEFAULT 'married' NOT NULL,
	"marriage_order" integer DEFAULT 1 NOT NULL,
	"start_date_precision" text DEFAULT 'unknown' NOT NULL,
	"start_date" date,
	"start_year" integer,
	"start_date_text" text,
	"end_date_text" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "persons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tree_id" uuid NOT NULL,
	"legacy_id" integer,
	"display_name" text NOT NULL,
	"full_name" text,
	"nickname" text,
	"native_name" text,
	"is_name_unknown" boolean DEFAULT false NOT NULL,
	"placeholder_label" text,
	"gender" text DEFAULT 'U' NOT NULL,
	"is_living" boolean DEFAULT true NOT NULL,
	"birth_date_precision" text DEFAULT 'unknown' NOT NULL,
	"birth_date" date,
	"birth_year" integer,
	"birth_date_text" text,
	"death_date_precision" text DEFAULT 'unknown' NOT NULL,
	"death_date" date,
	"death_year" integer,
	"death_date_text" text,
	"blood_group" text,
	"occupation" text,
	"education" text,
	"bio_markdown" text,
	"nationality" text,
	"birth_place" text,
	"current_city" text,
	"current_country" text,
	"latitude" double precision,
	"longitude" double precision,
	"contact_phone" text,
	"contact_email" text,
	"avatar_url" text,
	"sibling_order" integer DEFAULT 0 NOT NULL,
	"is_twin" boolean DEFAULT false NOT NULL,
	"created_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tree_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tree_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"claimed_person_id" uuid,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tree_share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tree_id" uuid NOT NULL,
	"token" text NOT NULL,
	"label" text NOT NULL,
	"passcode_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp,
	"last_accessed_at" timestamp,
	"created_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tree_share_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "family_trees" ADD CONSTRAINT "family_trees_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "life_events" ADD CONSTRAINT "life_events_tree_id_family_trees_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."family_trees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "life_events" ADD CONSTRAINT "life_events_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_child_links" ADD CONSTRAINT "parent_child_links_tree_id_family_trees_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."family_trees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_child_links" ADD CONSTRAINT "parent_child_links_parent_id_persons_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_child_links" ADD CONSTRAINT "parent_child_links_child_id_persons_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_child_links" ADD CONSTRAINT "parent_child_links_partnership_id_partnerships_id_fk" FOREIGN KEY ("partnership_id") REFERENCES "public"."partnerships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partnerships" ADD CONSTRAINT "partnerships_tree_id_family_trees_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."family_trees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partnerships" ADD CONSTRAINT "partnerships_partner1_id_persons_id_fk" FOREIGN KEY ("partner1_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partnerships" ADD CONSTRAINT "partnerships_partner2_id_persons_id_fk" FOREIGN KEY ("partner2_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persons" ADD CONSTRAINT "persons_tree_id_family_trees_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."family_trees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persons" ADD CONSTRAINT "persons_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tree_members" ADD CONSTRAINT "tree_members_tree_id_family_trees_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."family_trees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tree_members" ADD CONSTRAINT "tree_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tree_members" ADD CONSTRAINT "tree_members_claimed_person_id_persons_id_fk" FOREIGN KEY ("claimed_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tree_share_links" ADD CONSTRAINT "tree_share_links_tree_id_family_trees_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."family_trees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tree_share_links" ADD CONSTRAINT "tree_share_links_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "family_trees_created_by_idx" ON "family_trees" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "life_events_tree_id_idx" ON "life_events" USING btree ("tree_id");--> statement-breakpoint
CREATE INDEX "life_events_person_id_idx" ON "life_events" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "parent_child_links_parent_child_type_uniq" ON "parent_child_links" USING btree ("parent_id","child_id","lineage_type");--> statement-breakpoint
CREATE INDEX "parent_child_links_tree_id_idx" ON "parent_child_links" USING btree ("tree_id");--> statement-breakpoint
CREATE INDEX "parent_child_links_child_id_idx" ON "parent_child_links" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "parent_child_links_parent_id_idx" ON "parent_child_links" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "partnerships_tree_id_idx" ON "partnerships" USING btree ("tree_id");--> statement-breakpoint
CREATE INDEX "partnerships_p1_idx" ON "partnerships" USING btree ("partner1_id");--> statement-breakpoint
CREATE INDEX "partnerships_p2_idx" ON "partnerships" USING btree ("partner2_id");--> statement-breakpoint
CREATE INDEX "persons_tree_id_idx" ON "persons" USING btree ("tree_id");--> statement-breakpoint
CREATE INDEX "persons_tree_legacy_idx" ON "persons" USING btree ("tree_id","legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tree_members_tree_user_uniq" ON "tree_members" USING btree ("tree_id","user_id");--> statement-breakpoint
CREATE INDEX "tree_members_user_id_idx" ON "tree_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tree_share_links_tree_id_idx" ON "tree_share_links" USING btree ("tree_id");