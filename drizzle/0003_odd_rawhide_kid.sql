ALTER TABLE "cycles" ALTER COLUMN "name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cycles" ALTER COLUMN "year_month" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cycles" ADD COLUMN "release_note" text;--> statement-breakpoint
CREATE UNIQUE INDEX "cycles_proj_version_uq" ON "cycles" USING btree ("project_id","version");