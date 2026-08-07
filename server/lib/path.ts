// Design Ref: §3.2 — 이 앱의 유일한 도메인 로직. React·DB 미의존, 순수 함수만.
// Plan SC: C6 — cogmo-report 실측 링크(F2~F6)를 T1~T9 픽스처로 그대로 사용.

export type LinkClass = 'external' | 'anchor' | 'directory' | 'document'

/** 저장용 정규화: 선행 '/'·'./' 제거, 빈 세그먼트 압축. '..' 포함 시 reject. */
export function normalizePath(raw: string): string {
  const segments = raw.split('/').filter((s) => s !== '' && s !== '.')
  if (segments.some((s) => s === '..')) {
    throw new Error(`path must not contain '..': ${raw}`)
  }
  return segments.join('/')
}

/** href를 4종으로 분류한다. 판정은 문자열 형태만 보고 하며 존재 여부와 무관하다. */
export function classifyLink(href: string): LinkClass {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return 'external' // http:, https:, mailto: 등
  if (href.startsWith('#')) return 'anchor'
  const withoutAnchor = href.split('#')[0].split('?')[0]
  return withoutAnchor.endsWith('/') ? 'directory' : 'document'
}

/**
 * 현재 문서 path 기준으로 상대링크를 절대 경로로 해석한다.
 * '..'이 루트를 뚫으면 null. '#앵커'·'?쿼리'는 잘라내고 판정하며, 반환값에는 포함하지 않는다
 * (렌더링 시 SmartLink가 원본 href의 앵커를 그대로 붙인다).
 */
export function resolveRelative(fromDocPath: string, link: string): string | null {
  if (classifyLink(link) === 'external' || classifyLink(link) === 'anchor') return null

  const pathPart = link.split('#')[0].split('?')[0]
  const fromDir = fromDocPath.split('/').slice(0, -1) // 현재 문서의 디렉터리 세그먼트

  const stack = [...fromDir]
  for (const seg of pathPart.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') {
      if (stack.length === 0) return null // 루트 초과
      stack.pop()
    } else {
      stack.push(seg)
    }
  }

  const resolved = stack.join('/')
  // 디렉터리 링크(FR-09)는 trailing slash가 판정의 근거이므로 보존한다
  return pathPart.endsWith('/') ? `${resolved}/` : resolved
}
