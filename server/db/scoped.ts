// Design Ref: §9.2 — 전 쿼리가 ownerId 조인을 강제하는 우회 불가 헬퍼. routes는 이 모듈만 거친다.
import { and, eq, inArray, like } from 'drizzle-orm'
import { getDb } from './client.js'
import { documents, projects, workspaces } from './schema.js'
import type {
  CreateDocumentInput,
  CreateProjectInput,
  CreateWorkspaceInput,
  UpdateDocumentInput,
  UpdateProjectInput,
  UpdateWorkspaceInput,
} from '../../shared/schema.js'

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
