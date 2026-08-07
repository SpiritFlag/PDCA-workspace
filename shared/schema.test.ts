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
})
