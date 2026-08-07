// Design Ref: §9.1 — 기존 routes/projects.ts에서 기계적 추출. 동작 변경 없음(FR-20 대상 아님).
import * as db from '../db/scoped.js'
import { ServiceError } from '../lib/errors.js'
import type { CreateProjectInput, UpdateProjectInput } from '../../shared/schema.js'

export async function getProject(ownerId: string, id: string) {
  const row = await db.getProject(ownerId, id)
  if (!row) throw new ServiceError('NOT_FOUND', '')
  return row
}

export async function updateProject(ownerId: string, id: string, input: UpdateProjectInput) {
  const row = await db.updateProject(ownerId, id, input)
  if (!row) throw new ServiceError('NOT_FOUND', '')
  return row
}

export async function deleteProject(ownerId: string, id: string) {
  const ok = await db.deleteProject(ownerId, id)
  if (!ok) throw new ServiceError('NOT_FOUND', '')
}

export async function listProjectsInWorkspace(ownerId: string, workspaceId: string) {
  const ws = await db.getWorkspace(ownerId, workspaceId)
  if (!ws) throw new ServiceError('NOT_FOUND', '')
  return db.listProjects(ownerId, workspaceId)
}

export async function createProjectInWorkspace(
  ownerId: string,
  workspaceId: string,
  input: CreateProjectInput,
) {
  const row = await db.createProject(ownerId, workspaceId, input)
  if (!row) throw new ServiceError('NOT_FOUND', 'workspace not found')
  return row
}
