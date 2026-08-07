// Design Ref: §3.2 — PAT 형식·해시. 순수 crypto만(node:crypto), 서비스·미들웨어가 공유.
import { createHash, randomBytes } from 'node:crypto'

const PAT_PREFIX = 'pdcaw_'

/** pdcaw_ + 256bit 랜덤(base64url). 접두어가 authMiddleware 분기 키(F4)이자 유출 시 grep 가능. */
export function generateToken(): string {
  return `${PAT_PREFIX}${randomBytes(32).toString('base64url')}`
}

/** 단순 SHA-256 hex — 토큰 자체가 256bit 엔트로피라 솔트·bcrypt 불필요(§3.2) */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function isPatToken(token: string): boolean {
  return token.startsWith(PAT_PREFIX)
}
