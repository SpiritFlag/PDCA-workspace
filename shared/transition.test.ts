// Design Ref: §3.3 단위 테스트 필수 케이스 T1~T8
import { describe, expect, it } from 'vitest'
import { canTransition, isClosed } from './transition'

describe('canTransition', () => {
  it('T1: todo → doing, user — 착수 허용 (Q10a)', () => {
    expect(canTransition('todo', 'doing', 'user')).toBe(true)
  })

  it('T2: todo → doing, mcp — 거부 (TRANSITION_DENIED의 원천)', () => {
    expect(canTransition('todo', 'doing', 'mcp')).toBe(false)
  })

  it('T3: doing → done — user 허용 / mcp 거부', () => {
    expect(canTransition('doing', 'done', 'user')).toBe(true)
    expect(canTransition('doing', 'done', 'mcp')).toBe(false)
  })

  it('T4: todo → resolved, mcp — 허용 (해소, Q10b)', () => {
    expect(canTransition('todo', 'resolved', 'mcp')).toBe(true)
  })

  it('T5: todo → dropped, mcp — 허용', () => {
    expect(canTransition('todo', 'dropped', 'mcp')).toBe(true)
  })

  it('T6: resolved → todo — user 허용(재개) / mcp 거부', () => {
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
