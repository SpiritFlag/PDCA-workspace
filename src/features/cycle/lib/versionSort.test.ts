import { describe, expect, it } from 'vitest'
import { compareVersions, parseVersion, sortCycles } from './versionSort'

describe('parseVersion', () => {
  it('v 접두를 제거하고 숫자 배열로 파싱', () => {
    expect(parseVersion('v0.1.10')).toEqual([0, 1, 10])
  })
  it('v 없이도 파싱', () => {
    expect(parseVersion('1.2.3')).toEqual([1, 2, 3])
  })
  it('숫자 아닌 파트는 0', () => {
    expect(parseVersion('v0.x.1')).toEqual([0, 0, 1])
  })
})

describe('compareVersions', () => {
  it('v0.1.10 은 v0.1.2 보다 크다 (숫자 비교)', () => {
    expect(compareVersions('v0.1.10', 'v0.1.2')).toBeGreaterThan(0)
  })
  it('v0.1.0 은 v0.1.1 보다 작다', () => {
    expect(compareVersions('v0.1.0', 'v0.1.1')).toBeLessThan(0)
  })
  it('같은 버전은 0', () => {
    expect(compareVersions('v1.0.0', 'v1.0.0')).toBe(0)
  })
  it('메이저가 우선한다', () => {
    expect(compareVersions('v2.0.0', 'v1.9.9')).toBeGreaterThan(0)
  })
})

describe('sortCycles', () => {
  const items = [
    { name: 'b', version: 'v0.1.2' },
    { name: 'a', version: 'v0.1.10' },
    { name: 'c', version: 'v0.1.0' },
  ]

  it('version-desc: 최신 버전이 앞 (기본)', () => {
    expect(sortCycles(items, 'version-desc').map((c) => c.version)).toEqual([
      'v0.1.10',
      'v0.1.2',
      'v0.1.0',
    ])
  })

  it('version-asc: 오래된 버전이 앞', () => {
    expect(sortCycles(items, 'version-asc').map((c) => c.version)).toEqual([
      'v0.1.0',
      'v0.1.2',
      'v0.1.10',
    ])
  })

  it('name: 이름순', () => {
    expect(sortCycles(items, 'name').map((c) => c.name)).toEqual(['a', 'b', 'c'])
  })

  it('원본 배열을 변경하지 않는다', () => {
    const before = items.map((c) => c.version)
    sortCycles(items, 'version-asc')
    expect(items.map((c) => c.version)).toEqual(before)
  })
})
