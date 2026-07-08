-- User preference columns (defaults cover existing rows).
ALTER TABLE "users" ADD COLUMN "timezone" text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "default_range" text DEFAULT '30d' NOT NULL;--> statement-breakpoint

-- Team owner + access code: add nullable, backfill existing rows, then enforce.
ALTER TABLE "teams" ADD COLUMN "owner_user_id" uuid;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "access_code" text;--> statement-breakpoint

-- Existing (admin-created) teams get the oldest admin as owner.
UPDATE "teams"
SET "owner_user_id" = (
  SELECT "id" FROM "users"
  WHERE "role" = 'admin'
  ORDER BY "created_at"
  LIMIT 1
)
WHERE "owner_user_id" IS NULL;--> statement-breakpoint

-- Give each existing team a random access code.
UPDATE "teams"
SET "access_code" = upper(substr(md5(random()::text || "id"::text), 1, 8))
WHERE "access_code" IS NULL;--> statement-breakpoint

ALTER TABLE "teams" ALTER COLUMN "owner_user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ALTER COLUMN "access_code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_access_code_unique" UNIQUE("access_code");
