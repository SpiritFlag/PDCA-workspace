import { describe, expect, it } from 'vitest'
import { extractLinkHrefs } from './extractLinks'

describe('extractLinkHrefs', () => {
  it('extracts multiple distinct links', () => {
    const md = '[a](refine-db-cycle-1.plan.md) 와 [b](../../../code-review/a.md) 참고'
    expect(extractLinkHrefs(md)).toEqual([
      'refine-db-cycle-1.plan.md',
      '../../../code-review/a.md',
    ])
  })

  it('dedupes repeated links', () => {
    const md = '[a](x.md) [b](x.md)'
    expect(extractLinkHrefs(md)).toEqual(['x.md'])
  })

  it('returns empty for no links', () => {
    expect(extractLinkHrefs('그냥 텍스트')).toEqual([])
  })

  it('extracts links with line-anchor refs', () => {
    const md = '[코드](../../../../app/main.py#L52)'
    expect(extractLinkHrefs(md)).toEqual(['../../../../app/main.py#L52'])
  })
})
