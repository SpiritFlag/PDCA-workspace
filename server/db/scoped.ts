// Design Ref: §9.2 — 전 쿼리가 ownerId 조인을 강제하는 우회 불가 헬퍼. services/*만 이 모듈을 거친다.
import { and, desc, eq, inArray, like, sql } from 'drizzle-orm'
import { getDb } from './client.js'
import { apiTokens, backlogItems, cycles, documents, projects, workspaces } from './schema.js'
import type {
  CreateBacklogItemInput,
  CreateCycleInput,
  CreateDocumentInput,
  CreateProjectInput,
  CreateWorkspaceInput,
  UpdateBacklogItemInput,
  UpdateCycleInput,
  UpdateDocumentInput,
  UpdateProjectInput,
  UpdateWorkspaceInput,
} from '../../shared/schema.js'
import type { BacklogStatus } from '../../shared/transition.js'

// ---- Workspaces ----

export function listWorkspaces(ownerId: string) {
  return getDb().select().from(workspaces).where(eq(workspaces.ownerId, ownerId))
}

export async function getWorkspace(ownerId: string, id: string) {
  const [row] = await getDb()
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.id, id), eq(workspaces.ownerId, ownerId)))
  return row ?? null
}

export async function createWorkspace(ownerId: string, input: CreateWorkspaceInput) {
  const [row] = await getDb()
    .insert(workspaces)
    .values({ ownerId, ...input })
    .returning()
  return row
}

export async function updateWorkspace(ownerId: string, id: string, input: UpdateWorkspaceInput) {
  const existing = await getWorkspace(ownerId, id)
  if (!existing) return null
  const [row] = await getDb()
    .update(workspaces)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(workspaces.id, id))
    .returning()
  return row
}

export async function deleteWorkspace(ownerId: string, id: string) {
  const existing = await getWorkspace(ownerId, id)
  if (!existing) return false
  await getDb().delete(workspaces).where(eq(workspaces.id, id))
  return true
}

// ---- Projects (ownership는 workspace.ownerId 조인으로 확인) ----

export function listProjects(ownerId: string, workspaceId: string) {
  return getDb()
    .select({ project: projects })
    .from(projects)
    .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
    .where(and(eq(projects.workspaceId, workspaceId), eq(workspaces.ownerId, ownerId)))
    .then((rows) => rows.map((r) => r.project))
}

export async function getProject(ownerId: string, projectId: string) {
  const [row] = await getDb()
    .select({ project: projects })
    .from(projects)
    .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
    .where(and(eq(projects.id, projectId), eq(workspaces.ownerId, ownerId)))
  return row?.project ?? null
}

export async function createProject(
  ownerId: string,
  workspaceId: string,
  input: CreateProjectInput,
) {
  const ws = await getWorkspace(ownerId, workspaceId)
  if (!ws) return null
  const [row] = await getDb()
    .insert(projects)
    .values({ workspaceId, ...input })
    .returning()
  return row
}

export async function updateProject(ownerId: string, projectId: string, input: UpdateProjectInput) {
  const existing = await getProject(ownerId, projectId)
  if (!existing) return null
  const [row] = await getDb()
    .update(projects)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(projects.id, projectId))
    .returning()
  return row
}

export async function deleteProject(ownerId: string, projectId: string) {
  const existing = await getProject(ownerId, projectId)
  if (!existing) return false
  await getDb().delete(projects).where(eq(projects.id, projectId))
  return true
}

// ---- Documents (ownership는 project->workspace 2단 조인) ----

export function listDocuments(ownerId: string, projectId: string) {
  return getDb()
    .select({
      id: documents.id,
      projectId: documents.projectId,
      title: documents.title,
      path: documents.path,
      kind: documents.kind,
      pdcaStage: documents.pdcaStage,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .innerJoin(projects, eq(documents.projectId, projects.id))
    .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
    .where(and(eq(documents.projectId, projectId), eq(workspaces.ownerId, ownerId)))
}

export async function getDocument(ownerId: string, documentId: string) {
  const [row] = await getDb()
    .select({ document: documents })
    .from(documents)
    .innerJoin(projects, eq(documents.projectId, projects.id))
    .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
    .where(and(eq(documents.id, documentId), eq(workspaces.ownerId, ownerId)))
  return row?.document ?? null
}

export async function getDocumentByPath(ownerId: string, projectId: string, path: string) {
  const [row] = await getDb()
    .select({ document: documents })
    .from(documents)
    .innerJoin(projects, eq(documents.projectId, projects.id))
    .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
    .where(
      and(
        eq(documents.projectId, projectId),
        eq(documents.path, path),
        eq(workspaces.ownerId, ownerId),
      ),
    )
  return row?.document ?? null
}

export async function createDocument(
  ownerId: string,
  projectId: string,
  input: CreateDocumentInput,
) {
  const project = await getProject(ownerId, projectId)
  if (!project) return { error: 'PROJECT_NOT_FOUND' as const }
  const dup = await getDocumentByPath(ownerId, projectId, input.path)
  if (dup) return { error: 'PATH_TAKEN' as const, path: input.path }
  const [row] = await getDb()
    .insert(documents)
    .values({ projectId, ...input })
    .returning()
  return { document: row }
}

export async function updateDocument(
  ownerId: string,
  documentId: string,
  input: UpdateDocumentInput,
) {
  const existing = await getDocument(ownerId, documentId)
  if (!existing) return { error: 'NOT_FOUND' as const }
  if (input.path && input.path !== existing.path) {
    const dup = await getDocumentByPath(ownerId, existing.projectId, input.path)
    if (dup) return { error: 'PATH_TAKEN' as const, path: input.path }
  }
  const [row] = await getDb()
    .update(documents)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(documents.id, documentId))
    .returning()
  return { document: row }
}

export async function deleteDocument(ownerId: string, documentId: string) {
  const existing = await getDocument(ownerId, documentId)
  if (!existing) return false
  await getDb().delete(documents).where(eq(documents.id, documentId))
  return true
}

/** Design Ref: §7.5 링크 판정 흐름 — 후보 경로 중 실존하는 것만 반환 (단일 IN 쿼리) */
export async function resolveExistingPaths(
  ownerId: string,
  projectId: string,
  candidatePaths: string[],
) {
  if (candidatePaths.length === 0) return []
  const rows = await getDb()
    .select({ path: documents.path })
    .from(documents)
    .innerJoin(projects, eq(documents.projectId, projects.id))
    .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
    .where(
      and(
        eq(documents.projectId, projectId),
        eq(workspaces.ownerId, ownerId),
        inArray(documents.path, candidatePaths),
      ),
    )
  return rows.map((r) => r.path)
}

/** Design Ref: FR-09 — 디렉터리 링크 착지점. prefix 인덱스(text_pattern_ops)를 타는 LIKE 쿼리. */
export async function listByPrefix(ownerId: string, projectId: string, prefix: string) {
  return getDb()
    .select({
      path: documents.path,
      title: documents.title,
      kind: documents.kind,
      pdcaStage: documents.pdcaStage,
    })
    .from(documents)
    .innerJoin(projects, eq(documents.projectId, projects.id))
    .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
    .where(
      and(
        eq(documents.projectId, projectId),
        eq(workspaces.ownerId, ownerId),
        like(documents.path, `${prefix}%`),
      ),
    )
}

// ---- Cycles (ownership는 project->workspace 2단 조인, documents와 동일 패턴) ----

export function listCycles(ownerId: string, projectId: string) {
  return getDb()
    .select({ cycle: cycles })
    .from(cycles)
    .innerJoin(projects, eq(cycles.projectId, projects.id))
    .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
    .where(and(eq(cycles.projectId, projectId), eq(workspaces.ownerId, ownerId)))
    .then((rows) => rows.map((r) => r.cycle))
}

export async function getCycle(ownerId: string, id: string) {
  const [row] = await getDb()
    .select({ cycle: cycles })
    .from(cycles)
    .innerJoin(projects, eq(cycles.projectId, projects.id))
    .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
    .where(and(eq(cycles.id, id), eq(workspaces.ownerId, ownerId)))
  return row?.cycle ?? null
}

export async function getCycleByVersion(ownerId: string, projectId: string, version: string) {
  const [row] = await getDb()
    .select({ cycle: cycles })
    .from(cycles)
    .innerJoin(projects, eq(cycles.projectId, projects.id))
    .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
    .where(
      and(
        eq(cycles.projectId, projectId),
        eq(cycles.version, version),
        eq(workspaces.ownerId, ownerId),
      ),
    )
  return row?.cycle ?? null
}

export async function getCycleByName(ownerId: string, projectId: string, name: string) {
  const [row] = await getDb()
    .select({ cycle: cycles })
    .from(cycles)
    .innerJoin(projects, eq(cycles.projectId, projects.id))
    .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
    .where(
      and(eq(cycles.projectId, projectId), eq(cycles.name, name), eq(workspaces.ownerId, ownerId)),
    )
  return row?.cycle ?? null
}

export async function createCycle(ownerId: string, projectId: string, input: CreateCycleInput) {
  const project = await getProject(ownerId, projectId)
  if (!project) return { error: 'PROJECT_NOT_FOUND' as const }
  const dupVersion = await getCycleByVersion(ownerId, projectId, input.version)
  if (dupVersion) return { error: 'VERSION_TAKEN' as const, version: input.version }
  if (input.name) {
    const dupName = await getCycleByName(ownerId, projectId, input.name)
    if (dupName) return { error: 'NAME_TAKEN' as const, name: input.name }
  }
  const [row] = await getDb()
    .insert(cycles)
    .values({ projectId, ...input })
    .returning()
  return { cycle: row }
}

export async function updateCycle(ownerId: string, id: string, input: UpdateCycleInput) {
  const existing = await getCycle(ownerId, id)
  if (!existing) return { error: 'NOT_FOUND' as const }
  if (input.version && input.version !== existing.version) {
    const dup = await getCycleByVersion(ownerId, existing.projectId, input.version)
    if (dup) return { error: 'VERSION_TAKEN' as const, version: input.version }
  }
  if (input.name && input.name !== existing.name) {
    const dup = await getCycleByName(ownerId, existing.projectId, input.name)
    if (dup) return { error: 'NAME_TAKEN' as const, name: input.name }
  }
  const [row] = await getDb()
    .update(cycles)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(cycles.id, id))
    .returning()
  return { cycle: row }
}

export async function deleteCycle(ownerId: string, id: string) {
  const existing = await getCycle(ownerId, id)
  if (!existing) return false
  await getDb().delete(cycles).where(eq(cycles.id, id))
  return true
}

// ---- Backlog Items (ownership는 project->workspace 2단 조인, documents와 동일 패턴) ----

export function listBacklogItems(
  ownerId: string,
  projectId: string,
  statuses?: BacklogStatus[],
) {
  return getDb()
    .select({ item: backlogItems })
    .from(backlogItems)
    .innerJoin(projects, eq(backlogItems.projectId, projects.id))
    .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
    .where(
      and(
        eq(backlogItems.projectId, projectId),
        eq(workspaces.ownerId, ownerId),
        statuses && statuses.length > 0 ? inArray(backlogItems.status, statuses) : undefined,
      ),
    )
    .orderBy(backlogItems.sortOrder)
    .then((rows) => rows.map((r) => r.item))
}

export async function getBacklogItem(ownerId: string, id: string) {
  const [row] = await getDb()
    .select({ item: backlogItems })
    .from(backlogItems)
    .innerJoin(projects, eq(backlogItems.projectId, projects.id))
    .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
    .where(and(eq(backlogItems.id, id), eq(workspaces.ownerId, ownerId)))
  return row?.item ?? null
}

/** Design Ref: §4.1 — 신규 항목은 그 프로젝트 전체(접힘 섹션 포함) 맨 뒤에 붙는다 */
export async function nextBacklogSortOrder(ownerId: string, projectId: string) {
  const [row] = await getDb()
    .select({ sortOrder: backlogItems.sortOrder })
    .from(backlogItems)
    .innerJoin(projects, eq(backlogItems.projectId, projects.id))
    .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
    .where(and(eq(backlogItems.projectId, projectId), eq(workspaces.ownerId, ownerId)))
    .orderBy(desc(backlogItems.sortOrder))
    .limit(1)
  return row ? row.sortOrder + 1 : 0
}

export async function createBacklogItemRow(
  ownerId: string,
  projectId: string,
  input: CreateBacklogItemInput,
) {
  const project = await getProject(ownerId, projectId)
  if (!project) return null
  const sortOrder = await nextBacklogSortOrder(ownerId, projectId)
  const [row] = await getDb()
    .insert(backlogItems)
    .values({ projectId, ...input, status: 'todo', sortOrder })
    .returning()
  return row
}

export async function updateBacklogItemRow(
  ownerId: string,
  id: string,
  input: UpdateBacklogItemInput,
) {
  const existing = await getBacklogItem(ownerId, id)
  if (!existing) return null
  const [row] = await getDb()
    .update(backlogItems)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(backlogItems.id, id))
    .returning()
  return row
}

export async function deleteBacklogItemRow(ownerId: string, id: string) {
  const existing = await getBacklogItem(ownerId, id)
  if (!existing) return false
  await getDb().delete(backlogItems).where(eq(backlogItems.id, id))
  return true
}

/** Design Ref: §3.4 — 단일 SQL 다중행 UPDATE로 원자적 재번호. 소유권은 호출자가 사전 검증. */
export async function reorderBacklogItems(projectId: string, orderedIds: string[]) {
  const values = sql.join(
    orderedIds.map((id, ord) => sql`(${id}::uuid, ${ord}::int)`),
    sql`, `,
  )
  await getDb().execute(sql`
    UPDATE backlog_items AS b
    SET sort_order = v.ord, updated_at = now()
    FROM (VALUES ${values}) AS v(id, ord)
    WHERE b.id = v.id
      AND b.project_id = ${projectId}::uuid
  `)
}

// ---- API Tokens (독립 — Neon Auth 사용자 id로 직접 스코프, D-04) ----

const TOKEN_LIST_COLUMNS = {
  id: apiTokens.id,
  name: apiTokens.name,
  createdAt: apiTokens.createdAt,
  lastUsedAt: apiTokens.lastUsedAt,
}

/** tokenHash는 절대 반환하지 않는다(§7 보안) */
export function listApiTokens(ownerId: string) {
  return getDb()
    .select(TOKEN_LIST_COLUMNS)
    .from(apiTokens)
    .where(eq(apiTokens.ownerId, ownerId))
    .orderBy(desc(apiTokens.createdAt))
}

export async function createApiToken(ownerId: string, name: string, tokenHash: string) {
  const [row] = await getDb()
    .insert(apiTokens)
    .values({ ownerId, name, tokenHash })
    .returning(TOKEN_LIST_COLUMNS)
  return row
}

export async function deleteApiToken(ownerId: string, id: string) {
  const rows = await getDb()
    .delete(apiTokens)
    .where(and(eq(apiTokens.id, id), eq(apiTokens.ownerId, ownerId)))
    .returning({ id: apiTokens.id })
  return rows.length > 0
}

/** Design Ref: §4.2 인증 분기 — 해시로 유니크 조회. 이 함수만이 owner_id 스코프 없이 조회한다(인증 자체가 스코프 결정) */
export async function findApiTokenByHash(tokenHash: string) {
  const [row] = await getDb().select().from(apiTokens).where(eq(apiTokens.tokenHash, tokenHash))
  return row ?? null
}

export async function touchApiTokenLastUsed(id: string) {
  await getDb().update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, id))
}
