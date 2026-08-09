// Design Ref: §8.2 t3
import { describe, expect, it } from 'vitest'
import { isGeneralDoc } from './docKind'

describe('isGeneralDoc', () => {
  it('t3: kind가 pdca가 아니면 true, pdca면 false', () => {
    expect(isGeneralDoc({ kind: 'general' })).toBe(true)
    expect(isGeneralDoc({ kind: 'pdca' })).toBe(false)
  })
})
