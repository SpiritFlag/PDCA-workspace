// PDCA 사이클 버전 정렬 — v0.1.10 > v0.1.2 처럼 각 숫자 파트를 "숫자"로 비교한다.
// localeCompare(문자열 정렬)로는 v0.1.10이 v0.1.2보다 앞서는 오류가 나므로 전용 비교 함수를 둔다.

/** 'v0.1.10' → [0, 1, 10]. 선행 'v'는 무시, 숫자 아닌 파트는 0으로 처리. */
export function parseVersion(v: string): number[] {
  return v
    .replace(/^v/i, '')
    .split('.')
    .map((n) => {
      const parsed = parseInt(n, 10)
      return Number.isNaN(parsed) ? 0 : parsed
    })
}

/** a<b면 음수, a>b면 양수, 같으면 0 (오름차순=오래된 버전이 앞). 길이 다르면 짧은 쪽을 0으로 채워 비교. */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

export type CycleSortMode = 'version-desc' | 'version-asc' | 'name'

/** 버전 배열을 정렬 모드에 따라 새 배열로 반환한다(원본 불변). name은 사이클 미연결 시 없을 수 있다. */
export function sortCycles<T extends { version: string; name?: string | null }>(
  items: readonly T[],
  mode: CycleSortMode,
): T[] {
  const copy = [...items]
  if (mode === 'name') {
    copy.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
  } else {
    copy.sort((a, b) => {
      const cmp = compareVersions(a.version, b.version)
      // 버전이 같으면 이름으로 안정적 tie-break
      if (cmp === 0) return (a.name ?? '').localeCompare(b.name ?? '')
      return mode === 'version-desc' ? -cmp : cmp
    })
  }
  return copy
}
