// Design Ref: §3.2 — T1~T9는 cogmo-report 실측 링크(Plan F2~F6)를 그대로 픽스처화한 것
import { describe, expect, it } from 'vitest'
import { classifyLink, normalizePath, resolveRelative } from './path'

const FROM = 'docs/PDCA/2026-08/x/x.plan.md'

describe('resolveRelative', () => {
  it('T1: 형제 문서', () => {
    expect(resolveRelative(FROM, 'refine-db-cycle-1.plan.md')).toBe(
      'docs/PDCA/2026-08/x/refine-db-cycle-1.plan.md',
    )
  })

  it('T2: ./ 접두 형제 문서', () => {
    expect(resolveRelative(FROM, './y.design.md')).toBe('docs/PDCA/2026-08/x/y.design.md')
  })

  it('T3: 타 폴더 (../../../)', () => {
    expect(resolveRelative(FROM, '../../../code-review/a.md')).toBe('docs/code-review/a.md')
  })

  it('T4: 루트 도달 (../../../../CLAUDE.md)', () => {
    expect(resolveRelative(FROM, '../../../../CLAUDE.md')).toBe('CLAUDE.md')
  })

  it('T5: 루트 초과 시 null', () => {
    expect(resolveRelative(FROM, '../../../../../etc/passwd')).toBeNull()
  })

  it('T6: 디렉터리 링크는 trailing slash 보존', () => {
    expect(resolveRelative(FROM, '../260731-python-314/')).toBe(
      'docs/PDCA/2026-08/260731-python-314/',
    )
  })

  it('T7: 앵커·라인 참조는 분리 후 판정', () => {
    expect(resolveRelative(FROM, '../../../../app/main.py#L52')).toBe('app/main.py')
    expect(resolveRelative(FROM, '../../../../CLAUDE.md#L73-L83')).toBe('CLAUDE.md')
  })

  it('T8: 외부 링크는 null', () => {
    expect(resolveRelative(FROM, 'https://github.com/foo/bar')).toBeNull()
    expect(resolveRelative(FROM, 'mailto:a@b.com')).toBeNull()
  })

  it('순수 앵커(#...)는 null', () => {
    expect(resolveRelative(FROM, '#section')).toBeNull()
  })
})

describe('normalizePath', () => {
  it('T9: 선행 ./ 와 중복 슬래시 제거', () => {
    expect(normalizePath('./docs//a.md')).toBe('docs/a.md')
  })

  it('T9: ..가 포함되면 reject', () => {
    expect(() => normalizePath('../a.md')).toThrow()
  })

  it('선행 슬래시 제거', () => {
    expect(normalizePath('/docs/a.md')).toBe('docs/a.md')
  })
})

describe('classifyLink', () => {
  it('external', () => {
    expect(classifyLink('https://github.com/foo/bar')).toBe('external')
    expect(classifyLink('mailto:a@b.com')).toBe('external')
  })

  it('anchor', () => {
    expect(classifyLink('#section')).toBe('anchor')
  })

  it('directory', () => {
    expect(classifyLink('../260731-python-314/')).toBe('directory')
  })

  it('document', () => {
    expect(classifyLink('refine-db-cycle-1.plan.md')).toBe('document')
    expect(classifyLink('app/main.py#L52')).toBe('document')
  })
})
