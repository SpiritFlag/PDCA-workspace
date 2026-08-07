// Design Ref: §3.3 — Q10a·Q10b의 코드화. 서버 서비스·MCP 툴·UI 배지가 전부 이것만 호출

export type BacklogStatus = 'todo' | 'doing' | 'done' | 'resolved' | 'dropped'
export type Actor = 'user' | 'mcp'

const MCP_ALLOWED_TARGETS: readonly BacklogStatus[] = ['resolved', 'dropped']

/** actor='user'는 전 전이 허용. actor='mcp'는 to ∈ {resolved, dropped}만. from===to는 항상 true */
export function canTransition(from: BacklogStatus, to: BacklogStatus, actor: Actor): boolean {
  if (from === to) return true
  if (actor === 'user') return true
  return MCP_ALLOWED_TARGETS.includes(to)
}

/** 종료 상태 여부 — 접힘 섹션 분류·closed_on 권장 판정에 공용 */
export function isClosed(status: BacklogStatus): boolean {
  return status === 'done' || status === 'resolved' || status === 'dropped'
}
