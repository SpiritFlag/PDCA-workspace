// Design Ref: §3.2 — Q10a·Q10b의 코드화(2차) → 6차 개정: 완료 판정은 "판단"이라 클로드도,
// todo 복귀(재개·재작업)는 "결정"이라 형 전용(D-42). 서버 서비스·MCP 툴·UI 배지가 전부 이것만 호출

export type BacklogStatus = 'todo' | 'doing' | 'done' | 'resolved' | 'dropped'
export type Actor = 'user' | 'mcp'

// Design Ref: §3.2 D-42·D-44 — mcp 허용 목적지 = 전 상태 − todo. tools.ts의 zod enum이
// 이 튜플에서 파생된다(1·2차 방어의 집합 단일 원천). 닫혀 있는 것: todo 복귀(여기), hard delete(D-43, 툴 미등록)
export const MCP_ALLOWED_TARGETS = [
  'doing', 'done', 'resolved', 'dropped',
] as const satisfies readonly BacklogStatus[]

/** actor='user'는 전 전이 허용. actor='mcp'는 to ∈ MCP_ALLOWED_TARGETS — todo 복귀만 형 전용(D-42). from===to는 항상 true */
export function canTransition(from: BacklogStatus, to: BacklogStatus, actor: Actor): boolean {
  if (from === to) return true
  if (actor === 'user') return true
  return (MCP_ALLOWED_TARGETS as readonly BacklogStatus[]).includes(to)
}

/** 종료 상태 여부 — 접힘 섹션 분류·closed_on 권장 판정에 공용 */
export function isClosed(status: BacklogStatus): boolean {
  return status === 'done' || status === 'resolved' || status === 'dropped'
}

// Design Ref: §3.2 D-45 — "언제 이 상태를 찍는가"의 단일 원천(형 정의 2026-08-08 + Checkpoint 3
// CK3-1 확정). 소비자: tools.ts backlog_update description / ItemDialog 배지 툴팁.
// labels.ts는 표시명·색 전용(FR-63)
export const STATUS_MEANING: Record<BacklogStatus, string> = {
  todo: '아직 착수하지 않은 항목',
  doing: '지금 작업 중인 항목',
  done: '이 문제를 해결하려고 의도했고, 의도대로 해결됨',
  resolved: '의도한 건 아닌데 다른 작업 중 우연히 같이 해결됨 또는 필요가 없어짐',
  dropped: '하지 않기로 판단해 내려놓은 항목 (되돌릴 수 있음)',
}
