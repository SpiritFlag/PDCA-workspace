// Design Ref: §9 D-76 — 릴리즈 상세 URL 단일 원천. 소비처 3곳(SidebarTree·CycleCard·
// LatestReleaseCard)이 이 함수를 거친다. ReleasePage는 삭제 성공 후 개요로 리다이렉트할
// 뿐 이 함수를 쓰지 않는다(Design §2.1 다이어그램).
export function releaseUrl(wsSlug: string, projSlug: string, version: string): string {
  return `/w/${wsSlug}/p/${projSlug}/r/${version}`
}
