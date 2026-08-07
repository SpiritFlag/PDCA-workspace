// Design Ref: §3.1 데이터 모델 — Plan §7.3의 3테이블. 전부 1:N, 다대다 없음
import { pgTable, uuid, text, timestamp, pgEnum, uniqueIndex, index } from 'drizzle-orm/pg-core'

export const documentKind = pgEnum('document_kind', ['pdca', 'general'])
export const pdcaStage = pgEnum('pdca_stage', ['plan', 'design', 'analysis', 'report'])

export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: text('owner_id').notNull(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('workspaces_owner_slug_uq').on(t.ownerId, t.slug),
    index('workspaces_owner_idx').on(t.ownerId),
  ],
)

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    serviceUrl: text('service_url'),
    githubUrl: text('github_url'),
    githubBranch: text('github_branch').default('main'),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('projects_ws_slug_uq').on(t.workspaceId, t.slug),
    index('projects_ws_idx').on(t.workspaceId),
  ],
)

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    // Plan SC: C6 — 레포 루트 기준 경로. 저장 전 normalizePath 통과 필수 (server/lib/path.ts)
    path: text('path').notNull(),
    kind: documentKind('kind').notNull(),
    pdcaStage: pdcaStage('pdca_stage'),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('documents_proj_path_uq').on(t.projectId, t.path),
    index('documents_proj_idx').on(t.projectId),
  ],
)
