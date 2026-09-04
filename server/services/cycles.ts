// PDCA 사이클 도메인 로직 단일 원천. REST(routes/cycles)가 이 함수만 호출.
// 버전 중복만 CONFLICT(details.target: 'version'). 사이클명은 유일하지 않다(pdca-skill v1).
import * as db from '../db/scoped.js'
import { ServiceError } from '../lib/errors.js'
import type { CreateCycleInput, UpdateCycleInput } from '../../shared/schema.js'

async function ensureProject(ownerId: string, projectId: string) {
  const project = await db.getProject(ownerId, projectId)
  if (!project) throw new ServiceError('NOT_FOUND', '')
  return project
}

export async function listCycles(ownerId: string, projectId: string) {
  await ensureProject(ownerId, projectId)
  return db.listCycles(ownerId, projectId)
}

/** Design Ref: §4.2 — cycle_read(MCP)의 단건 조회. ensureProject 선행으로 타인 프로젝트는
 * version 존재 여부와 무관하게 404(m12). version 없음도 같은 NOT_FOUND(§6.2, 존재 여부 누설 방지) */
export async function getCycleByVersion(ownerId: string, projectId: string, version: string) {
  await ensureProject(ownerId, projectId)
  const cycle = await db.getCycleByVersion(ownerId, projectId, version)
  if (!cycle) throw new ServiceError('NOT_FOUND', '')
  return cycle
}

export async function createCycle(ownerId: string, projectId: string, input: CreateCycleInput) {
  const result = await db.createCycle(ownerId, projectId, input)
  if ('error' in result) {
    if (result.error === 'PROJECT_NOT_FOUND') throw new ServiceError('NOT_FOUND', '')
    throw new ServiceError('CONFLICT', '이미 존재하는 버전입니다', { target: 'version' })
  }
  return result.cycle
}

export async function updateCycle(ownerId: string, id: string, input: UpdateCycleInput) {
  const result = await db.updateCycle(ownerId, id, input)
  if ('error' in result) {
    if (result.error === 'NOT_FOUND') throw new ServiceError('NOT_FOUND', '')
    throw new ServiceError('CONFLICT', '이미 존재하는 버전입니다', { target: 'version' })
  }
  return result.cycle
}

export async function deleteCycle(ownerId: string, id: string) {
  const ok = await db.deleteCycle(ownerId, id)
  if (!ok) throw new ServiceError('NOT_FOUND', '')
}
