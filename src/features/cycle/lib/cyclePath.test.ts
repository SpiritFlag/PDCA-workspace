// Design Ref: §8.2 t4 — parseCycleStagePath 계열은 9차 S9에서 제거(고아 export, 8차 analysis M-1).
import { describe, expect, it } from 'vitest'
import { PDCA_STAGES, cycleStagePath } from './cyclePath'

describe('cycleStagePath', () => {
  it('t4: 연월·사이클명·stage로 4종 문서 경로를 조립한다', () => {
    for (const stage of PDCA_STAGES) {
      expect(cycleStagePath('2026-08', 'refine-cycle-closing', stage)).toBe(
        `docs/PDCA/2026-08/refine-cycle-closing/refine-cycle-closing.${stage}.md`,
      )
    }
  })
})
