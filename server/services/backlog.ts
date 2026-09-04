// 백로그 도메인 로직 단일 원천. REST(routes/backlog)·MCP(mcp/tools)가 이 함수만 호출.
import * as db from '../db/scoped.js'
import { ServiceError } from '../lib/errors.js'
import { canTransition, type Actor, type BacklogStatus } from '../../shared/transition.js'
import { backlogStatusSchema } from '../../shared/schema.js'
import type { CreateBacklogItemInput, UpdateBacklogItemInput } from '../../shared/schema.js'
import { filterBacklogRows, parseStatusList, prependDetail, stripDetail } from '../../shared/backlog.js'
import type { BacklogListFilter } from '../../shared/backlog.js'

async function ensureProject(ownerId: string, projectId: string) {
  const project = await db.getProject(ownerId, projectId)
  if (!project) throw new ServiceError('NOT_FOUND', '')
  return project
}

/** 문자열 쿼리(REST)를 필터로 바꾼다. 모르는 상태 값은 VALIDATION_ERROR. */
export function parseListOptions(q: { status?: string; stale?: string; q?: string }): BacklogListFilter {
  const statuses = parseStatusList(q.status)
  const bad = statuses.filter((s) => !backlogStatusSchema.options.includes(s as BacklogStatus))
  if (bad.length > 0) {
    throw new ServiceError('VALIDATION_ERROR', '', {
      fieldErrors: { status: [`모르는 상태 값: ${bad.join(', ')}`] },
    })
  }
  return {
    statuses: statuses as BacklogStatus[],
    staleDays: q.stale !== undefined ? Number(q.stale) : undefined,
    q: q.q,
  }
}

/** 전체 행(detail 포함). 상태 필터는 DB에서, 정체·부분일치는 메모리에서(보드가 수백 건이라 충분하고 규칙이 한곳에 산다). */
export async function listBacklog(ownerId: string, projectId: string, opts: BacklogListFilter = {}) {
  await ensureProject(ownerId, projectId)
  const rows = await db.listBacklogItems(ownerId, projectId, opts.statuses)
  return filterBacklogRows(rows, { staleDays: opts.staleDays, q: opts.q, now: opts.now })
}

/** 요약 행(detail 없음). 큰 보드가 컨텍스트에 들어오게(pdca-skill v1 §9.2). detail은 getBacklogItem으로. */
export async function listBacklogSummary(ownerId: string, projectId: string, opts: BacklogListFilter = {}) {
  const rows = await listBacklog(ownerId, projectId, opts)
  return rows.map(stripDetail)
}

export async function getBacklogItem(ownerId: string, id: string) {
  const row = await db.getBacklogItem(ownerId, id)
  if (!row) throw new ServiceError('NOT_FOUND', '')
  return row
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

  // canTransition이 false가 되는 경우는 actor='mcp' ∧ to='todo' ∧ from≠'todo' 단 하나라 문안이 todo 고정이어도 정확하다
  if (input.status !== undefined && !canTransition(existing.status, input.status, actor)) {
    throw new ServiceError(
      'TRANSITION_DENIED',
      'status를 todo로 되돌릴 수 없습니다 — 재개·재작업 결정은 사용자가 UI에서 직접 합니다.',
      { from: existing.status, to: input.status, actor },
    )
  }

  // appendDetail은 서버가 원안 앞에 블록을 얹는다. DB 컬럼은 아니므로 patch에서 뺀다.
  const { appendDetail, ...patch } = input
  const finalPatch =
    appendDetail !== undefined ? { ...patch, detail: prependDetail(existing.detail, appendDetail) } : patch

  const row = await db.updateBacklogItemRow(ownerId, id, finalPatch)
  if (!row) throw new ServiceError('NOT_FOUND', '')
  return row
}

export async function deleteBacklogItem(ownerId: string, id: string) {
  const ok = await db.deleteBacklogItemRow(ownerId, id)
  if (!ok) throw new ServiceError('NOT_FOUND', '')
}

/** 받은 id 집합이 그 프로젝트 전체 항목 집합과 정확히 같아야 한다 */
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
