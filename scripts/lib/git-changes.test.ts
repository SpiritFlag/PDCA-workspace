// Design Ref: §8.2 — parseDiffLines·parseStatusLines (g1~g6). V8 실측 표본이 픽스처.
import { describe, expect, it } from 'vitest'
import { parseDiffLines, parseStatusLines } from './git-changes'

describe('parseDiffLines', () => {
  it('g1: M/A 표본을 modified/added로 판정한다', () => {
    const stdout = [
      'M\tdocs/PDCA/2026-08/backlog-with-mcp/backlog-with-mcp.design.md',
      'A\tdocs/PDCA/2026-08/expand-mcp-agency/expand-mcp-agency.plan.md',
    ].join('\n')
    expect(parseDiffLines(stdout)).toEqual([
      { path: 'docs/PDCA/2026-08/backlog-with-mcp/backlog-with-mcp.design.md', kind: 'modified' },
      { path: 'docs/PDCA/2026-08/expand-mcp-agency/expand-mcp-agency.plan.md', kind: 'added' },
    ])
  })

  it('g2: R100\\told\\tnew 는 renamed + renamedFrom', () => {
    const stdout = 'R100\tdocs/PDCA/2026-08/x/old.plan.md\tdocs/PDCA/2026-08/x/new.plan.md'
    expect(parseDiffLines(stdout)).toEqual([
      {
        path: 'docs/PDCA/2026-08/x/new.plan.md',
        kind: 'renamed',
        renamedFrom: 'docs/PDCA/2026-08/x/old.plan.md',
      },
    ])
  })

  it('g3: D 는 deleted', () => {
    const stdout = 'D\tdocs/PDCA/2026-08/x/x.plan.md'
    expect(parseDiffLines(stdout)).toEqual([
      { path: 'docs/PDCA/2026-08/x/x.plan.md', kind: 'deleted' },
    ])
  })

  it('g5: 경로에 공백이 있어도 온전히 보존한다', () => {
    const stdout = 'M\tdocs/PDCA/2026-08/my cycle/my cycle.plan.md'
    expect(parseDiffLines(stdout)).toEqual([
      { path: 'docs/PDCA/2026-08/my cycle/my cycle.plan.md', kind: 'modified' },
    ])
  })

  it('g6: 빈 stdout은 빈 배열', () => {
    expect(parseDiffLines('')).toEqual([])
  })
})

describe('parseStatusLines', () => {
  it('g4: ?? / " M" / " D" 를 untracked/modified/deleted로 판정한다', () => {
    const stdout = [
      '?? docs/PDCA/2026-08/refine-cycle-closing/refine-cycle-closing.plan.md',
      ' M docs/PDCA/_INDEX.md',
      ' D docs/PDCA/2026-08/x/x.plan.md',
    ].join('\n')
    expect(parseStatusLines(stdout)).toEqual([
      { path: 'docs/PDCA/2026-08/refine-cycle-closing/refine-cycle-closing.plan.md', kind: 'untracked' },
      { path: 'docs/PDCA/_INDEX.md', kind: 'modified' },
      { path: 'docs/PDCA/2026-08/x/x.plan.md', kind: 'deleted' },
    ])
  })

  it('g5: porcelain 경로에 공백이 있어도 온전히 보존한다', () => {
    const stdout = '?? docs/PDCA/2026-08/my cycle/my cycle.plan.md'
    expect(parseStatusLines(stdout)).toEqual([
      { path: 'docs/PDCA/2026-08/my cycle/my cycle.plan.md', kind: 'untracked' },
    ])
  })

  it('g6: 빈 stdout은 빈 배열', () => {
    expect(parseStatusLines('')).toEqual([])
  })
})
