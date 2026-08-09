// Design Ref: §3, §4.1 — 백로그 도메인 로직 단일 원천. REST(module-1)·MCP(module-4)가 이 함수만 호출.
import * as db from '../db/scoped.js'
import { ServiceError } from '../lib/errors.js'
import { canTransition, type Actor, type BacklogStatus } from '../../shared/transition.js'
import type { CreateBacklogItemInput, UpdateBacklogItemInput } from '../../shared/schema.js'

async function ensureProject(ownerId: string, projectId: string) {
  const project = await db.getProject(ownerId, projectId)
  if (!project) throw new ServiceError('NOT_FOUND', '')
  return project
}

export async function listBacklog(ownerId: string, projectId: string, statuses?: BacklogStatus[]) {
  await ensureProject(ownerId, projectId)
  return db.listBacklogItems(ownerId, projectId, statuses)
}

export async function createBacklogItem(
  ownerId: string,
  projectId: string,
  input: CreateBacklogItemInput,
) {
  const row = await db.createBacklogItemRow(ownerId, projectId, input)
  if (!row) throw new ServiceError('NOT_FOUND', '')
  return row
}

export async function updateBacklogItem(
  ownerId: string,
  id: string,
  input: UpdateBacklogItemInput,
  actor: Actor,
) {
  const existing = await db.getBacklogItem(ownerId, id)
  if (!existing) throw new ServiceError('NOT_FOUND', '')

  // Design Ref: §6.1 CK3-2 — 6차 개정 후 canTransition이 false가 되는 경우는
  // actor='mcp' ∧ to='todo' ∧ from≠'todo' 단 하나라 문안이 todo 고정이어도 정확하다
  if (input.status !== undefined && !canTransition(existing.status, input.status, actor)) {
    throw new ServiceError(
      'TRANSITION_DENIED',
      'status를 todo로 되돌릴 수 없습니다 — 재개·재작업 결정은 사용자가 UI에서 직접 합니다.',
      { from: existing.status, to: input.status, actor },
    )
  }

  const row = await db.updateBacklogItemRow(ownerId, id, input)
  if (!row) throw new ServiceError('NOT_FOUND', '')
  return row
}

export async function deleteBacklogItem(ownerId: string, id: string) {
  const ok = await db.deleteBacklogItemRow(ownerId, id)
  if (!ok) throw new ServiceError('NOT_FOUND', '')
}

/** Design Ref: §3.4 — 받은 id 집합이 그 프로젝트 전체 항목 집합과 정확히 같아야 한다 */
export async function reorderBacklog(ownerId: string, projectId: string, ids: string[]) {
  await ensureProject(ownerId, projectId)
  const current = await db.listBacklogItems(ownerId, projectId)
  const currentIds = new Set(current.map((item) => item.id))
  const givenIds = new Set(ids)

  if (
    currentIds.size !== givenIds.size ||
    [...currentIds].some((id) => !givenIds.has(id))
  ) {
    throw new ServiceError('VALIDATION_ERROR', '', {
      fieldErrors: { ids: ['프로젝트의 전체 백로그 항목 id 집합과 일치해야 합니다'] },
    })
  }

  await db.reorderBacklogItems(projectId, ids)
}
