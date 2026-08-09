// Design Ref: §9 D-75 — pdca 문서 숨김 판정 단일 원천. 표시 컴포넌트 2곳(DocumentList,
// SidebarTree.DocumentsSection)에만 적용한다 — existingPaths 파생에는 절대 쓰지 않는다(RK-48).
export function isGeneralDoc(doc: { kind: string }): boolean {
  return doc.kind !== 'pdca'
}
