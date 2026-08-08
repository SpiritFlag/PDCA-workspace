// PDCA 사이클 도메인 로직 단일 원천. REST(routes/cycles)가 이 함수만 호출.
// 사이클명 중복은 documents의 path CONFLICT 패턴(details.target)을 재사용한다.
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

export async function createCycle(ownerId: string, projectId: string, input: CreateCycleInput) {
  const result = await db.createCycle(ownerId, projectId, input)
  if ('error' in result) {
    if (result.error === 'PROJECT_NOT_FOUND') throw new ServiceError('NOT_FOUND', '')
    if (result.error === 'VERSION_TAKEN')
      throw new ServiceError('CONFLICT', '이미 존재하는 버전입니다', { target: 'version' })
    throw new ServiceError('CONFLICT', '이미 존재하는 사이클명입니다', { target: 'name' })
  }
  return result.cycle
}

export async function updateCycle(ownerId: string, id: string, input: UpdateCycleInput) {
  const result = await db.updateCycle(ownerId, id, input)
  if ('error' in result) {
    if (result.error === 'NOT_FOUND') throw new ServiceError('NOT_FOUND', '')
    if (result.error === 'VERSION_TAKEN')
      throw new ServiceError('CONFLICT', '이미 존재하는 버전입니다', { target: 'version' })
    throw new ServiceError('CONFLICT', '이미 존재하는 사이클명입니다', { target: 'name' })
  }
  return result.cycle
}

export async function deleteCycle(ownerId: string, id: string) {
  const ok = await db.deleteCycle(ownerId, id)
  if (!ok) throw new ServiceError('NOT_FOUND', '')
}
