// Design Ref: §8.2 — parseCycleStagePath 왕복 법칙(t1~t7). module-1, red 먼저(5차 선례).
import { describe, expect, it } from 'vitest'
import { PDCA_STAGES, cycleStagePath, parseCycleStagePath } from './cyclePath'

describe('parseCycleStagePath', () => {
  it('t1: cycleStagePath로 만든 경로는 4 stage 전수 원값으로 복원된다(빌더 전사)', () => {
    for (const stage of PDCA_STAGES) {
      const path = cycleStagePath('2026-08', 'refine-cycle-closing', stage)
      expect(parseCycleStagePath(path)).toEqual({
        yearMonth: '2026-08',
        name: 'refine-cycle-closing',
        stage,
      })
    }
  })

  it('t2: 파싱 성공 경로를 cycleStagePath로 재조립하면 원 경로가 나온다(파서 후사)', () => {
    const path = 'docs/PDCA/2026-08/refine-cycle-closing/refine-cycle-closing.design.md'
    const parsed = parseCycleStagePath(path)
    expect(parsed).not.toBeNull()
    expect(cycleStagePath(parsed!.yearMonth, parsed!.name, parsed!.stage)).toBe(path)
  })

  it('t3: docs/PDCA/_INDEX.md 은 null (V7 유일 예외 실물)', () => {
    expect(parseCycleStagePath('docs/PDCA/_INDEX.md')).toBeNull()
  })

  it('t4: 디렉터리명과 파일명 어간이 다르면 null (자기식별 강제)', () => {
    expect(parseCycleStagePath('docs/PDCA/2026-08/a/b.plan.md')).toBeNull()
  })

  it('t5: 확장자·stage가 형태를 벗어나면 null', () => {
    expect(parseCycleStagePath('docs/PDCA/2026-08/x/x.plan.md.tmp')).toBeNull()
    expect(parseCycleStagePath('docs/PDCA/2026-08/x/x.review.md')).toBeNull()
  })

  it('t6: docs/PDCA 접두를 벗어나면 null', () => {
    expect(parseCycleStagePath('docs/other/2026-08/x/x.plan.md')).toBeNull()
  })

  it('t7: 연월 형태 위반이면 null', () => {
    expect(parseCycleStagePath('docs/PDCA/2026-8/x/x.plan.md')).toBeNull()
  })
})
