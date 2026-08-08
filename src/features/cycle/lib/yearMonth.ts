// 연월(YYYY-MM) 헬퍼 — 사이클 생성/임포트의 연월 드롭다운 소스.
function ymOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function currentYearMonth() {
  return ymOf(new Date())
}

/** 현재 기준 미래 2개월 ~ 과거 36개월 (최신순). */
export function yearMonthOptions(): string[] {
  const now = new Date()
  const out: string[] = []
  for (let i = 2; i >= -36; i--) {
    out.push(ymOf(new Date(now.getFullYear(), now.getMonth() + i, 1)))
  }
  return out
}
