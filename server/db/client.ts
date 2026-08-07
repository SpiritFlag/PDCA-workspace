// Design Ref: §7.2 D-04 — Neon HTTP 드라이버. 서버리스에서 커넥션 풀 고갈이 구조적으로 발생하지 않음
import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import * as schema from './schema.js'

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null

export function getDb() {
  if (_db) return _db
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  _db = drizzle(neon(url), { schema })
  return _db
}
