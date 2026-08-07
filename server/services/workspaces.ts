// Design Ref: §9.1 — 기존 routes/workspaces.ts에서 기계적 추출. 동작 변경 없음(FR-20 대상 아님).
import * as db from '../db/scoped.js'
import { ServiceError } from '../lib/errors.js'
import type { CreateWorkspaceInput, UpdateWorkspaceInput } from '../../shared/schema.js'

export function listWorkspaces(ownerId: string) {
  return db.listWorkspaces(ownerId)
}

export function createWorkspace(ownerId: string, input: CreateWorkspaceInput) {
  return db.createWorkspace(ownerId, input)
}

export async function getWorkspace(ownerId: string, id: string) {
  const row = await db.getWorkspace(ownerId, id)
  if (!row) throw new ServiceError('NOT_FOUND', '')
  return row
}

export async function updateWorkspace(ownerId: string, id: string, input: UpdateWorkspaceInput) {
  const row = await db.updateWorkspace(ownerId, id, input)
  if (!row) throw new ServiceError('NOT_FOUND', '')
  return row
}

export async function deleteWorkspace(ownerId: string, id: string) {
  const ok = await db.deleteWorkspace(ownerId, id)
  if (!ok) throw new ServiceError('NOT_FOUND', '')
}
