// Design Ref: §8.3·§8.5 — MCP L1 하네스. 권한 경계 개정(S1)·의미 명문화(S2)·cycles 읽기 툴(S3)·
// backlog_reorder 실행 확인(S5)의 실 dev DB 실증. 골격은 `./l1-harness.js`에서 가져온다(D-48).
//
// 시나리오 번호는 Plan §1.3.4 / Design §8.3의 m1~m13과 1:1. 픽스처는 §1.3.4 표 그대로:
// FX-A(owner A+ws+project) / FX-B(owner B, project 없음) / FX-item1~4(백로그 4건) /
// FX-cycle1(연결 버전, releaseNote 있음) / FX-cycle2(미연결 버전). 전부 `hns-`/`v9.` 이름공간이라
// 기존 `cleanup()`(l1-harness.js)이 함께 지운다.
//
// module-1 시점(개정 전): m1·m2만 존재 — "기준선 red" 기록용(§8.5). 현재 허용 집합은
// {resolved, dropped}뿐이라 doing·done 요청은 1차 방어(zod enum)에서 거부된다. m3~m13은
// module-2·3에서 S1·S2·S3 구현과 함께 채운다.
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { callTool, cleanup, hasDb, mintToken, req, seedWorkspaceProject } from './l1-harness.js'

describe.skipIf(!hasDb)('mcp L1 (실 dev DB)', () => {
  const RUN = randomUUID().slice(0, 8)
  const OWNER_A = `hns-owner-mcp-a-${RUN}`

  let tokenA: string
  let projectA: string
  let itemId1: string

  beforeAll(async () => {
    await cleanup() // 이전 실행 잔여물 선제거(FR-50)
    tokenA = await mintToken(OWNER_A, 'hns-mcp-l1-a')
    ;({ projectId: projectA } = await seedWorkspaceProject(tokenA, 'mcp-a'))

    // FX-item1 — m1→m2→m5 3단 순차 종속(Plan §1.3.4). todo로 시작
    const createRes = await req(tokenA, `/api/projects/${projectA}/backlog`, {
      method: 'POST',
      body: JSON.stringify({ title: 'hns-item1', priority: 'medium', openedOn: '2026-08-09' }),
    })
    const createBody = (await createRes.json()) as { data: { id: string } }
    itemId1 = createBody.data.id
  })

  afterAll(cleanup)

  // ── §8.5 기준선(개정 전) — m1·m2가 지금은 거부된다는 것을 기록 ──

  it('m1 [기준선] MCP status:doing — 현재 경계에서는 거부', async () => {
    const result = await callTool(tokenA, 'backlog_update', { id: itemId1, status: 'doing' })
    expect(result.isError).toBe(true)
  })

  it('m2 [기준선] MCP status:done — 현재 경계에서는 거부', async () => {
    const result = await callTool(tokenA, 'backlog_update', { id: itemId1, status: 'done' })
    expect(result.isError).toBe(true)
  })
})
