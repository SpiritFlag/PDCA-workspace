// Decision: [Do] zod 스키마의 런타임 에러(.partial() on refined schema 등)는 tsc가 못 잡고
// 모듈 import 자체를 실패시켜 서버리스 함수 전체를 죽인다 — import만으로 스모크 테스트.
import { describe, expect, it } from 'vitest'

describe('shared/schema module', () => {
  it('imports without throwing and exposes all schemas', async () => {
    const mod = await import('./schema')
    expect(mod.createWorkspaceSchema).toBeDefined()
    expect(mod.updateWorkspaceSchema).toBeDefined()
    expect(mod.createProjectSchema).toBeDefined()
    expect(mod.updateProjectSchema).toBeDefined()
    expect(mod.createDocumentSchema).toBeDefined()
    expect(mod.updateDocumentSchema).toBeDefined()
    expect(mod.resolveLinksSchema).toBeDefined()
  })

  it('updateDocumentSchema accepts a partial patch without kind/pdcaStage', async () => {
    const { updateDocumentSchema } = await import('./schema')
    const result = updateDocumentSchema.safeParse({ title: 'renamed' })
    expect(result.success).toBe(true)
  })

  it('createDocumentSchema rejects general kind with pdcaStage set', async () => {
    const { createDocumentSchema } = await import('./schema')
    const result = createDocumentSchema.safeParse({
      title: 't',
      path: 'a.md',
      kind: 'general',
      pdcaStage: 'plan',
      content: 'x',
    })
    expect(result.success).toBe(false)
  })

  // Design Ref: §8.2 t1~t3 — D-20(closedOn nullable) 실증
  it('updateBacklogItemSchema accepts closedOn:null and preserves it (t1)', async () => {
    const { updateBacklogItemSchema } = await import('./schema')
    const result = updateBacklogItemSchema.parse({ closedOn: null })
    expect('closedOn' in result).toBe(true)
    expect(result.closedOn).toBeNull()
  })

  it('updateBacklogItemSchema rejects a malformed closedOn (t2)', async () => {
    const { updateBacklogItemSchema } = await import('./schema')
    const result = updateBacklogItemSchema.safeParse({ closedOn: 'aaa' })
    expect(result.success).toBe(false)
  })

  it('updateBacklogItemSchema treats an omitted closedOn as unchanged (t3)', async () => {
    const { updateBacklogItemSchema } = await import('./schema')
    const result = updateBacklogItemSchema.parse({})
    expect('closedOn' in result).toBe(false)
  })

  // Design Ref: §8.2 t1~t5 — D-38(엄격 pairRule)·D-31a(name/yearMonth nullable) 실증
  it('updateCycleSchema accepts a null pair (unlink) and preserves both nulls (t1)', async () => {
    const { updateCycleSchema } = await import('./schema')
    const result = updateCycleSchema.parse({ name: null, yearMonth: null })
    expect(result.name).toBeNull()
    expect(result.yearMonth).toBeNull()
  })

  it('updateCycleSchema rejects a lone name patch (t2, I-1 회귀 고정)', async () => {
    const { updateCycleSchema } = await import('./schema')
    const result = updateCycleSchema.safeParse({ name: 'x' })
    expect(result.success).toBe(false)
  })

  it('updateCycleSchema accepts a releaseNote-only patch (t3, 부분 수정 무회귀)', async () => {
    const { updateCycleSchema } = await import('./schema')
    const result = updateCycleSchema.safeParse({ releaseNote: 'r' })
    expect(result.success).toBe(true)
  })

  it('updateCycleSchema rejects a mixed null/string pair (t4, RK-20 회귀 고정)', async () => {
    const { updateCycleSchema } = await import('./schema')
    const result = updateCycleSchema.safeParse({ name: null, yearMonth: '2026-08' })
    expect(result.success).toBe(false)
  })

  it('createCycleSchema accepts a null pair as an unlinked-version create (t5, FR-41)', async () => {
    const { createCycleSchema } = await import('./schema')
    const result = createCycleSchema.safeParse({
      version: 'v0.1.0',
      name: null,
      yearMonth: null,
    })
    expect(result.success).toBe(true)
  })
})
