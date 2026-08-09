// Design Ref: §8.2 단위 테스트 필수 케이스 T1~T11 (2차 T1~T8 + 6차 개정 T9~T11)
import { describe, expect, it } from 'vitest'
import { canTransition, isClosed, STATUS_MEANING, type BacklogStatus } from './transition'

describe('canTransition', () => {
  it('T1: todo → doing, user — 착수 허용 (Q10a)', () => {
    expect(canTransition('todo', 'doing', 'user')).toBe(true)
  })

  it('T2: todo → doing, mcp — 허용 (6차 D-42 개정. 완료 판정은 판단이라 클로드도)', () => {
    expect(canTransition('todo', 'doing', 'mcp')).toBe(true)
  })

  it('T3: doing → done — user·mcp 둘 다 허용 (6차 D-42 개정)', () => {
    expect(canTransition('doing', 'done', 'user')).toBe(true)
    expect(canTransition('doing', 'done', 'mcp')).toBe(true)
  })

  it('T4: todo → resolved, mcp — 허용 (해소, Q10b)', () => {
    expect(canTransition('todo', 'resolved', 'mcp')).toBe(true)
  })

  it('T5: todo → dropped, mcp — 허용', () => {
    expect(canTransition('todo', 'dropped', 'mcp')).toBe(true)
  })

  it('T6: resolved → todo — user 허용(재개) / mcp 거부 (잔여 경계, 유지)', () => {
    expect(canTransition('resolved', 'todo', 'user')).toBe(true)
    expect(canTransition('resolved', 'todo', 'mcp')).toBe(false)
  })

  it('T7: done → doing, user — 재작업 허용(user는 제한 없음)', () => {
    expect(canTransition('done', 'doing', 'user')).toBe(true)
  })

  it('T8: 동일 상태(x → x) — user·mcp 둘 다 허용 (내용만 수정하는 PATCH 통과용)', () => {
    expect(canTransition('todo', 'todo', 'user')).toBe(true)
    expect(canTransition('done', 'done', 'mcp')).toBe(true)
  })

  it('T9: done → todo, mcp — 거부 (6차 D-42 잔여 경계 직접 고정)', () => {
    expect(canTransition('done', 'todo', 'mcp')).toBe(false)
  })

  it('T10: dropped → todo, mcp — 거부 (T9와 대칭)', () => {
    expect(canTransition('dropped', 'todo', 'mcp')).toBe(false)
  })
})

describe('STATUS_MEANING', () => {
  const ALL_STATUSES: BacklogStatus[] = ['todo', 'doing', 'done', 'resolved', 'dropped']

  it('T11: 5키 존재 + 전부 빈 문자열이 아니다 (D-45 단일 원천)', () => {
    for (const s of ALL_STATUSES) {
      expect(STATUS_MEANING[s]).toBeTruthy()
    }
    expect(Object.keys(STATUS_MEANING).sort()).toEqual([...ALL_STATUSES].sort())
  })
})

describe('isClosed', () => {
  it('done·resolved·dropped는 종료 상태', () => {
    expect(isClosed('done')).toBe(true)
    expect(isClosed('resolved')).toBe(true)
    expect(isClosed('dropped')).toBe(true)
  })

  it('todo·doing은 종료 상태가 아니다', () => {
    expect(isClosed('todo')).toBe(false)
    expect(isClosed('doing')).toBe(false)
  })
})
