import { describe, expect, it } from 'vitest'
import { buildDocTree } from './buildDocTree'

describe('buildDocTree', () => {
  it('groups documents under shared folder prefixes', () => {
    const tree = buildDocTree([
      { path: 'docs/PDCA/x/a.plan.md', title: 'a' },
      { path: 'docs/PDCA/x/b.plan.md', title: 'b' },
      { path: 'docs/CLAUDE.md', title: 'claude' },
    ])
    expect(tree).toHaveLength(1) // 'docs' folder
    const docsFolder = tree[0]
    if (docsFolder.type !== 'folder') throw new Error('expected folder')
    expect(docsFolder.name).toBe('docs')
    // folders sort before docs, so PDCA folder first, then CLAUDE.md doc
    expect(docsFolder.children.map((c) => c.name)).toEqual(['PDCA', 'CLAUDE.md'])
  })

  it('handles a flat single document', () => {
    const tree = buildDocTree([{ path: 'README.md', title: 'r' }])
    expect(tree).toEqual([{ type: 'doc', name: 'README.md', path: 'README.md', title: 'r' }])
  })
})
