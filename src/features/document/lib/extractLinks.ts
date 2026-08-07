// Design Ref: §3.2 / §7.5 — 마크다운 본문에서 상대링크 후보를 추출하는 순수 함수.
// React·API 미의존. FR-12(임포트 링크 프리뷰)와 뷰어(module-3)가 공유한다.

const MD_LINK_RE = /\]\(([^)]+)\)/g

/** 본문에서 `](href)` 형태의 링크 href만 추출한다. 중복 제거. */
export function extractLinkHrefs(markdown: string): string[] {
  const hrefs = new Set<string>()
  for (const match of markdown.matchAll(MD_LINK_RE)) {
    const href = match[1].trim()
    if (href) hrefs.add(href)
  }
  return [...hrefs]
}
