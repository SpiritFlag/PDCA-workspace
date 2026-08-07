// Design Ref: §3.2, §4.2 — PAT 발급·조회·폐기 + 인증 검증. authMiddleware가 authenticateToken을 호출.
import * as db from '../db/scoped.js'
import { ServiceError } from '../lib/errors.js'
import { generateToken, hashToken } from '../lib/token.js'

export function listTokens(ownerId: string) {
  return db.listApiTokens(ownerId)
}

/** 평문은 이 반환값에만 존재한다 — 호출자(라우트)가 응답으로 1회 내보내고 이후 재구성 불가 */
export async function issueToken(ownerId: string, name: string) {
  const token = generateToken()
  const row = await db.createApiToken(ownerId, name, hashToken(token))
  return { ...row, token }
}

export async function revokeToken(ownerId: string, id: string) {
  const ok = await db.deleteApiToken(ownerId, id)
  if (!ok) throw new ServiceError('NOT_FOUND', '')
}

/** Design Ref: §4.2 — 해시 조회 성공 시 ownerId 반환 + last_used_at 갱신. 실패 시 null(미스는 401로 번역은 미들웨어 몫). */
export async function authenticateToken(token: string): Promise<string | null> {
  const row = await db.findApiTokenByHash(hashToken(token))
  if (!row) return null
  await db.touchApiTokenLastUsed(row.id)
  return row.ownerId
}
