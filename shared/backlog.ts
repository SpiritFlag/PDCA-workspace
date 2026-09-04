// 백로그 조회 필터 · detail 덧붙이기의 순수 함수 단일 원천 (pdca-skill v1 §9.2).
// REST 라우트 · MCP 툴 · 서비스가 전부 이 함수를 쓴다. DB 접근 없음 — 단위 테스트 대상.
import type { BacklogStatus } from './transition.js'

export type BacklogRow = {
  id: string
  status: BacklogStatus
  title: string
  detail: string | null
  updatedAt: Date | string
}

export type BacklogListFilter = {
  statuses?: BacklogStatus[]
  /** todo 항목 중 updatedAt이 N일 이상 지난 것만. 열린 항목이 썩는 문제라 todo에만 건다 */
  staleDays?: number
  /** 제목 · detail 부분일치(대소문자 무시) */
  q?: string
  now?: Date
}

/** [순수] 상태 · 정체 · 부분일치 필터. */
export function filterBacklogRows<T extends BacklogRow>(rows: T[], f: BacklogListFilter): T[] {
  const now = f.now ?? new Date()
  const q = f.q?.trim().toLowerCase()
  return rows.filter((row) => {
    if (f.statuses && f.statuses.length > 0 && !f.statuses.includes(row.status)) return false
    if (f.staleDays !== undefined) {
      if (row.status !== 'todo') return false
      const updated = row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt)
      const ageDays = (now.getTime() - updated.getTime()) / 86_400_000
      if (ageDays < f.staleDays) return false
    }
    if (q) {
      const hay = `${row.title}\n${row.detail ?? ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

/** [순수] 요약 형태 — detail을 뺀다. 100건이 넘어도 컨텍스트에 들어오게 하기 위한 것. */
export function stripDetail<T extends { detail: string | null }>(row: T): Omit<T, 'detail'> {
  const { detail: _detail, ...rest } = row
  return rest
}

/** [순수] detail 맨 앞에 블록을 얹고 기존 본문을 그대로 뒤에 붙인다. 원안은 지워지지 않는다. */
export function prependDetail(existing: string | null | undefined, block: string): string {
  const head = block.trimEnd()
  const tail = (existing ?? '').trim()
  return tail ? `${head}\n\n${tail}` : head
}

/** [순수] `a,b, c` → ['a','b','c']. 모르는 상태는 버리지 않고 그대로 돌려준다(호출자가 검증). */
export function parseStatusList(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}
