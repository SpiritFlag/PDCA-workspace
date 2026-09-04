import { describe, expect, it } from 'vitest'
import { PDCA_STAGES, cycleStagePath } from './cyclePath'

describe('cycleStagePath', () => {
  it('t1: 사이클 폴더와 stage로 6종 문서 경로를 조립한다 (폴더명 == 파일 어간)', () => {
    for (const stage of PDCA_STAGES) {
      expect(cycleStagePath('docs/PDCA/v1/v1.2.0-enhance-x', stage)).toBe(
        `docs/PDCA/v1/v1.2.0-enhance-x/v1.2.0-enhance-x.${stage}.md`,
      )
    }
  })

  it('t2: 옛 배치 폴더(연월)도 같은 규칙', () => {
    expect(cycleStagePath('docs/PDCA/2026-08/refine-cycle-closing', 'plan')).toBe(
      'docs/PDCA/2026-08/refine-cycle-closing/refine-cycle-closing.plan.md',
    )
  })

  it('t3: stage는 6개', () => {
    expect(PDCA_STAGES).toEqual(['plan', 'design', 'do', 'analysis', 'report', 'release'])
  })
})
