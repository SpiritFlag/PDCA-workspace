CREATE TYPE "public"."document_kind" AS ENUM('pdca', 'general');--> statement-breakpoint
CREATE TYPE "public"."pdca_stage" AS ENUM('plan', 'design', 'analysis', 'report');--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"path" text NOT NULL,
	"kind" "document_kind" NOT NULL,
	"pdca_stage" "pdca_stage",
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"service_url" text,
	"github_url" text,
	"github_branch" text DEFAULT 'main',
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "documents_proj_path_uq" ON "documents" USING btree ("project_id","path");--> statement-breakpoint
CREATE INDEX "documents_proj_idx" ON "documents" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_ws_slug_uq" ON "projects" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX "projects_ws_idx" ON "projects" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_owner_slug_uq" ON "workspaces" USING btree ("owner_id","slug");--> statement-breakpoint
CREATE INDEX "workspaces_owner_idx" ON "workspaces" USING btree ("owner_id");--> statement-breakpoint
-- Design Ref: §3.1 — drizzle-kit 미지원분 수동 추가
ALTER TABLE "documents" ADD CONSTRAINT "documents_stage_chk"
  CHECK ("kind" != 'general' OR "pdca_stage" IS NULL);--> statement-breakpoint
CREATE INDEX "documents_proj_path_pattern_idx"
  ON "documents" USING btree ("project_id", "path" text_pattern_ops);