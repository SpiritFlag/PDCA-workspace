// Design Ref: §5.3 SidebarTree — 문서 목록(경로 문자열)을 폴더 트리로 변환하는 순수 함수.
export type TreeNode =
  | { type: 'folder'; name: string; path: string; children: TreeNode[] }
  | { type: 'doc'; name: string; path: string; title: string }

export function buildDocTree(docs: { path: string; title: string }[]): TreeNode[] {
  const root: TreeNode & { type: 'folder' } = { type: 'folder', name: '', path: '', children: [] }

  for (const doc of docs) {
    const segments = doc.path.split('/')
    let cursor = root
    for (let i = 0; i < segments.length - 1; i++) {
      const name = segments[i]
      const path = segments.slice(0, i + 1).join('/') + '/'
      let next = cursor.children.find(
        (c): c is TreeNode & { type: 'folder' } => c.type === 'folder' && c.name === name,
      )
      if (!next) {
        next = { type: 'folder', name, path, children: [] }
        cursor.children.push(next)
      }
      cursor = next
    }
    cursor.children.push({ type: 'doc', name: segments[segments.length - 1], path: doc.path, title: doc.title })
  }

  const sortTree = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    for (const n of nodes) if (n.type === 'folder') sortTree(n.children)
  }
  sortTree(root.children)

  return root.children
}
