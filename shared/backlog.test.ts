import { describe, expect, it } from 'vitest'
import { filterBacklogRows, parseStatusList, prependDetail, stripDetail } from './backlog'
import type { BacklogRow } from './backlog'

const NOW = new Date('2026-09-04T00:00:00Z')
const rows: BacklogRow[] = [
  { id: 'a', status: 'todo', title: '오래된 todo', detail: null, updatedAt: '2026-08-01T00:00:00Z' },
  { id: 'b', status: 'todo', title: '최근 todo 가사', detail: null, updatedAt: '2026-09-03T00:00:00Z' },
  { id: 'c', status: 'done', title: '끝난 것', detail: '가사 싱크', updatedAt: new Date('2026-07-01T00:00:00Z') },
]

describe('filterBacklogRows', () => {
  it('b1: 상태 필터', () => {
    expect(filterBacklogRows(rows, { statuses: ['done'] }).map((r) => r.id)).toEqual(['c'])
  })
  it('b2: 정체 필터는 todo에만 걸린다', () => {
    expect(filterBacklogRows(rows, { staleDays: 14, now: NOW }).map((r) => r.id)).toEqual(['a'])
  })
  it('b3: 부분일치는 제목·detail 모두, 대소문자 무시', () => {
    expect(filterBacklogRows(rows, { q: '싱크' }).map((r) => r.id)).toEqual(['c'])
    expect(filterBacklogRows(rows, { q: 'TODO' }).length).toBe(2)
  })
  it('b4: 필터 없음이면 전건', () => {
    expect(filterBacklogRows(rows, {}).length).toBe(3)
  })
})

describe('stripDetail', () => {
  it('b5: detail 키 자체가 사라진다', () => {
    const s = stripDetail(rows[2])
    expect('detail' in s).toBe(false)
    expect(s.title).toBe('끝난 것')
  })
})

describe('prependDetail', () => {
  it('b6: 기존 본문 앞에 블록, 빈 줄로 분리', () => {
    expect(prependDetail('원안', '[2026-09-04 완료 — 근거: v1.2.0 SC-1]')).toBe(
      '[2026-09-04 완료 — 근거: v1.2.0 SC-1]\n\n원안',
    )
  })
  it('b7: 기존이 비면 블록만', () => {
    expect(prependDetail(null, '블록\n')).toBe('블록')
  })
})

describe('parseStatusList', () => {
  it('b8: 쉼표 구분, 공백 제거', () => {
    expect(parseStatusList('todo, done,,x ')).toEqual(['todo', 'done', 'x'])
    expect(parseStatusList(undefined)).toEqual([])
  })
})
