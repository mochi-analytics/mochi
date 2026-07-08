ALTER TABLE "bots" ADD COLUMN "share_id" uuid;--> statement-breakpoint
ALTER TABLE "bots" ADD CONSTRAINT "bots_share_id_unique" UNIQUE("share_id");