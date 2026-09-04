ALTER TYPE "public"."pdca_stage" ADD VALUE 'do' BEFORE 'analysis';--> statement-breakpoint
ALTER TYPE "public"."pdca_stage" ADD VALUE 'release';--> statement-breakpoint
ALTER TABLE "cycles" ADD COLUMN "dir" text;--> statement-breakpoint
UPDATE "cycles" SET "dir" = 'docs/PDCA/' || "year_month" || '/' || "name" WHERE "dir" IS NULL AND "name" IS NOT NULL AND "year_month" IS NOT NULL;
