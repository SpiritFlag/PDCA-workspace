// Design Ref: §8.3·§8.5 — MCP L1 하네스. 권한 경계 개정(S1)·의미 명문화(S2)·cycles 읽기 툴(S3)·
// backlog_reorder 실행 확인(S5)의 실 dev DB 실증. 골격은 `./l1-harness.js`에서 가져온다(D-48).
//
// 시나리오 번호는 Plan §1.3.4 / Design §8.3의 m1~m13과 1:1. 픽스처는 §1.3.4 표 그대로:
// FX-A(owner A+ws+project) / FX-B(owner B, project 없음) / FX-item1~4(백로그 4건) /
// FX-cycle1(연결 버전, releaseNote 있음) / FX-cycle2(미연결 버전). 전부 `hns-`/`v9.` 이름공간이라
// 기존 `cleanup()`(l1-harness.js)이 함께 지운다.
//
// module-1에서 m1·m2를 개정 전 기준선(red — isError)으로 먼저 기록했다(§8.5). module-2에서
// S1·S2 구현 후 m1·m2가 성공으로 반전되고, m3~m6이 채워졌다. module-3이 m7~m13(cycles·reorder)을 채운다.
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { callTool, cleanup, hasDb, mintToken, req, rpc, seedWorkspaceProject } from './l1-harness.js'

async function createItem(token: string, projectId: string, title: string) {
  const res = await req(token, `/api/projects/${projectId}/backlog`, {
    method: 'POST',
    body: JSON.stringify({ title, priority: 'medium', openedOn: '2026-08-09' }),
  })
  const created = (await res.json()) as { data: { id: string; status: string } }
  return created.data.id
}

describe.skipIf(!hasDb)('mcp L1 (실 dev DB)', () => {
  const RUN = randomUUID().slice(0, 8)
  const OWNER_A = `hns-owner-mcp-a-${RUN}`
  const OWNER_B = `hns-owner-mcp-b-${RUN}` // FX-B — 프로젝트 없음, m12 타인 경계 전용

  let tokenA: string
  let tokenB: string
  let projectA: string
  // FX-item1 — m1→m2→m5 3단 순차 종속(Plan §1.3.4)
  let itemId1: string
  let itemId2: string
  let itemId3: string
  let itemId4: string

  beforeAll(async () => {
    await cleanup() // 이전 실행 잔여물 선제거(FR-50)
    tokenA = await mintToken(OWNER_A, 'hns-mcp-l1-a')
    tokenB = await mintToken(OWNER_B, 'hns-mcp-l1-b')
    ;({ projectId: projectA } = await seedWorkspaceProject(tokenA, 'mcp-a'))

    itemId1 = await createItem(tokenA, projectA, 'hns-item1')
    itemId2 = await createItem(tokenA, projectA, 'hns-item2')
    itemId3 = await createItem(tokenA, projectA, 'hns-item3')
    itemId4 = await createItem(tokenA, projectA, 'hns-item4')

    // FX-cycle1(연결 버전, releaseNote 있음)·FX-cycle2(미연결 버전) — m9~m12
    await req(tokenA, `/api/projects/${projectA}/cycles`, {
      method: 'POST',
      body: JSON.stringify({
        version: 'v9.1.1',
        name: 'hns-cycle-mcp',
        yearMonth: '2026-08',
        releaseNote: 'hns release note body',
      }),
    })
    await req(tokenA, `/api/projects/${projectA}/cycles`, {
      method: 'POST',
      body: JSON.stringify({ version: 'v9.1.2' }),
    })
  })

  afterAll(cleanup)

  // ── m1~m6: S1 권한 확대 + 잔여 경계(D-42) + REST 무회귀 ──

  it('m1 MCP status:doing — 성공 (2차 #6 반전, D-42)', async () => {
    const result = await callTool(tokenA, 'backlog_update', { id: itemId1, status: 'doing' })
    expect(result.isError).toBe(false)
    expect((result.data as { status: string }).status).toBe('doing')
  })

  it('m2 [m1 종속] MCP status:done — 성공', async () => {
    const result = await callTool(tokenA, 'backlog_update', { id: itemId1, status: 'done' })
    expect(result.isError).toBe(false)
    expect((result.data as { status: string }).status).toBe('done')
  })

  it('m3 MCP status:resolved — 성공 (무회귀)', async () => {
    const result = await callTool(tokenA, 'backlog_update', { id: itemId2, status: 'resolved' })
    expect(result.isError).toBe(false)
  })

  it('m4 MCP status:dropped — 성공 (무회귀)', async () => {
    const result = await callTool(tokenA, 'backlog_update', { id: itemId3, status: 'dropped' })
    expect(result.isError).toBe(false)
  })

  // Decision: [Do] status enum이 MCP_ALLOWED_TARGETS(4값)에서 파생되므로(D-44), 'todo'는
  // zod 스키마 단계에서 이미 거부된다 — service의 canTransition(TRANSITION_DENIED, CK3-2 문안)엔
  // 도달하지 않는다. 스키마가 받는 값 집합과 canTransition이 허용하는 집합이 설계상 항상 일치하기
  // 때문에(2차부터 구조적으로 그랬다), MCP 경로에서 서비스 계층 거부는 사실상 도달 불가능하다.
  // 그래도 조용한 무시는 아니다 — SDK가 유효값을 명시하는 -32602 에러를 낸다(2차 §6.2 원칙 충족).
  it('m5 [m2 종속] MCP status:todo (done→todo) — zod 스키마 단계에서 거부 (잔여 경계 D-42)', async () => {
    const result = await callTool(tokenA, 'backlog_update', { id: itemId1, status: 'todo' })
    expect(result.isError).toBe(true)
    if (!result.isError) throw new Error('unreachable')
    expect(result.text).toContain('expected one of')
    expect(result.text).toContain('"doing"|"done"|"resolved"|"dropped"')
  })

  it('m6 REST PATCH status:doing (user) — 200 (무회귀, 2차 #5)', async () => {
    const res = await req(tokenA, `/api/backlog/${itemId4}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'doing' }),
    })
    expect(res.status).toBe(200)
  })

  // ── m7~m13: S3 cycles 읽기 툴 + S5 backlog_reorder 실행 확인 ──

  it('m7 tools/list — 정확히 10개, delete 계열 0', async () => {
    const res = await rpc(tokenA, 'tools/list')
    const json = (await res.json()) as { result: { tools: Array<{ name: string }> } }
    expect(json.result.tools).toHaveLength(10)
    expect(json.result.tools.some((t) => t.name.includes('delete'))).toBe(false)
  })

  it('m8 MCP backlog_reorder 실행 확인 (S5)', async () => {
    const result = await callTool(tokenA, 'backlog_reorder', {
      projectId: projectA,
      ids: [itemId4, itemId3, itemId2, itemId1],
    })
    expect(result.isError).toBe(false)
    expect(result.data).toEqual({ ok: true })
  })

  it('m9 cycle_list — 미연결분은 name·yearMonth null, releaseNote 키 부재(hasReleaseNote만)', async () => {
    const result = await callTool(tokenA, 'cycle_list', { projectId: projectA })
    expect(result.isError).toBe(false)
    const rows = result.data as Array<{
      version: string
      name: string | null
      yearMonth: string | null
      hasReleaseNote: boolean
      releaseNote?: unknown
    }>
    expect(rows).toHaveLength(2)
    const unlinked = rows.find((r) => r.version === 'v9.1.2')
    expect(unlinked?.name).toBeNull()
    expect(unlinked?.yearMonth).toBeNull()
    expect(unlinked?.hasReleaseNote).toBe(false)
    expect('releaseNote' in (unlinked ?? {})).toBe(false)
    const linked = rows.find((r) => r.version === 'v9.1.1')
    expect(linked?.hasReleaseNote).toBe(true)
    expect('releaseNote' in (linked ?? {})).toBe(false)
  })

  it('m10 cycle_read v9.1.1 — releaseNote 본문 일치', async () => {
    const result = await callTool(tokenA, 'cycle_read', { projectId: projectA, version: 'v9.1.1' })
    expect(result.isError).toBe(false)
    expect((result.data as { releaseNote: string }).releaseNote).toBe('hns release note body')
  })

  it('m11 cycle_read 없는 version — NOT_FOUND', async () => {
    const result = await callTool(tokenA, 'cycle_read', { projectId: projectA, version: 'v9.9.9' })
    expect(result.isError).toBe(true)
    if (!result.isError) throw new Error('unreachable')
    expect(result.text).toContain('NOT_FOUND')
  })

  it('m12 B 토큰으로 A의 cycle_read — NOT_FOUND (구분 없음)', async () => {
    const result = await callTool(tokenB, 'cycle_read', { projectId: projectA, version: 'v9.1.1' })
    expect(result.isError).toBe(true)
    if (!result.isError) throw new Error('unreachable')
    expect(result.text).toContain('NOT_FOUND')
  })

  it('m13 미인증 /api/mcp POST — 401', async () => {
    const res = await rpc(null, 'tools/list')
    expect(res.status).toBe(401)
  })
})
