// Design Ref: §3.1 데이터 모델 — Plan §7.3의 3테이블 + backlog-with-mcp 사이클의 2테이블 추가
import {
  pgTable,
  uuid,
  text,
  timestamp,
  date,
  integer,
  pgEnum,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'

export const documentKind = pgEnum('document_kind', ['pdca', 'general'])
export const pdcaStage = pgEnum('pdca_stage', ['plan', 'design', 'analysis', 'report'])
export const backlogPriority = pgEnum('backlog_priority', ['urgent', 'high', 'medium', 'low'])
export const backlogStatus = pgEnum('backlog_status', ['todo', 'doing', 'done', 'resolved', 'dropped'])

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

// 버전(release) — version이 프로젝트 내 유일. releaseNote(마크다운) + 선택적 PDCA 사이클(name+yearMonth).
// name은 nullable(사이클 없는 버전 허용). name 있을 때만 (project_id, name) 유일 — NULL은 postgres에서 중복 허용.
export const cycles = pgTable(
  'cycles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    version: text('version').notNull(), // "v0.1.0" — 정렬은 클라이언트 versionSort가 담당
    releaseNote: text('release_note'), // 마크다운
    name: text('name'), // 사이클 폴더명(연결 시). 없으면 릴리즈노트만 있는 버전
    yearMonth: text('year_month'), // "2026-08" — 경로 조립용(연결 시)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('cycles_proj_version_uq').on(t.projectId, t.version),
    uniqueIndex('cycles_proj_name_uq').on(t.projectId, t.name),
    index('cycles_proj_idx').on(t.projectId),
  ],
)

export const backlogItems = pgTable(
  'backlog_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }), // D-07: 프로젝트=보드
    title: text('title').notNull(),
    priority: backlogPriority('priority').notNull(),
    status: backlogStatus('status').notNull().default('todo'),
    detail: text('detail'), // 상세 md, 팝업 전용
    openedOn: date('opened_on').notNull(), // D-08: 형이 지정하는 생성일
    closedOn: date('closed_on'), //        형이 지정하는 처리일
    sortOrder: integer('sort_order').notNull(), // D-09: 서버가 0..N-1 정규화
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('backlog_proj_sort_idx').on(t.projectId, t.sortOrder)],
)

export const apiTokens = pgTable(
  'api_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: text('owner_id').notNull(),
    name: text('name').notNull(), // "claude-code-wsl" 같은 식별용
    tokenHash: text('token_hash').notNull(), // D-04: SHA-256 hex, 평문 미저장
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('api_tokens_hash_uq').on(t.tokenHash),
    index('api_tokens_owner_idx').on(t.ownerId),
  ],
)
