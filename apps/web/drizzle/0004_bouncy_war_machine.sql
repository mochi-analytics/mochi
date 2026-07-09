CREATE TABLE "alert_configs" (
	"bot_id" uuid PRIMARY KEY NOT NULL,
	"webhook_url" text NOT NULL,
	"offline_enabled" boolean DEFAULT true NOT NULL,
	"offline_after_minutes" integer DEFAULT 120 NOT NULL,
	"error_spike_enabled" boolean DEFAULT true NOT NULL,
	"error_rate_pct" integer DEFAULT 10 NOT NULL,
	"guild_drop_enabled" boolean DEFAULT true NOT NULL,
	"guild_drop_pct" integer DEFAULT 5 NOT NULL,
	"digest_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_states" (
	"bot_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"last_fired_at" timestamp with time zone,
	CONSTRAINT "alert_states_bot_id_kind_pk" PRIMARY KEY("bot_id","kind")
);
--> statement-breakpoint
ALTER TABLE "alert_configs" ADD CONSTRAINT "alert_configs_bot_id_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."bots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_states" ADD CONSTRAINT "alert_states_bot_id_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."bots"("id") ON DELETE cascade ON UPDATE no action;