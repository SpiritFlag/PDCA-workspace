// Design Ref: §8.1·§8.2 — prompts 표면 L1 하네스. 프롬프트는 DB를 읽지 않아(§3.1 M-1)
// 픽스처는 토큰 1개뿐(5T-2 N/A 근거와 동형) — mcp.l1.ts의 워크스페이스·프로젝트 시딩 불요.
//
// 시나리오 번호 p1~p8은 Design §8.2와 1:1. module-1은 배선(index.ts) 없이 이 파일을 먼저
// 완성해 red를 기록한다(p1~p6은 -32601, p7·p8은 인증·Origin 계층이 앞이라 이미 통과) —
// module-2가 index.ts에 registerPrompts를 배선하면 green으로 전환된다.
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BACKLOG_SYNC_TEXT, MAKE_CC_PROMPT_TEXT } from './mcp/prompts.js'
import { cleanup, getPrompt, hasDb, mintToken, req, rpc } from './l1-harness.js'

type ListPromptsEnvelope = {
  result?: {
    prompts: Array<{
      name: string
      title?: string
      description?: string
      arguments?: Array<{ name: string; description?: string; required?: boolean }>
    }>
  }
}

describe.skipIf(!hasDb)('prompts L1 (실 dev DB)', () => {
  const RUN = randomUUID().slice(0, 8)
  const OWNER = `hns-owner-prompts-${RUN}`
  let token: string

  beforeAll(async () => {
    await cleanup()
    token = await mintToken(OWNER, 'hns-prompts-l1')
  })

  afterAll(cleanup)

  it('p1 prompts/list — 정확히 2건, 인자 전부 required:false, 순서는 projectName 먼저', async () => {
    const res = await rpc(token, 'prompts/list')
    const json = (await res.json()) as ListPromptsEnvelope
    const prompts = json.result?.prompts ?? []
    expect(prompts).toHaveLength(2)

    const sync = prompts.find((p) => p.name === 'backlog_sync')
    expect(sync?.title).toBeTruthy()
    expect(sync?.description).toBeTruthy()
    expect(sync?.arguments?.map((a) => a.name)).toEqual(['projectName', 'cycleName'])
    expect(sync?.arguments?.every((a) => a.required === false)).toBe(true)

    const cc = prompts.find((p) => p.name === 'make_cc_prompt')
    expect(cc?.title).toBeTruthy()
    expect(cc?.description).toBeTruthy()
    expect(cc?.arguments?.map((a) => a.name)).toEqual(['projectName', 'targets', 'cycleName'])
    expect(cc?.arguments?.every((a) => a.required === false)).toBe(true)
  })

  it('p2 prompts/get backlog_sync 무인자 — 본문 상수와 완전일치', async () => {
    const result = await getPrompt(token, 'backlog_sync')
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.text).toBe(BACKLOG_SYNC_TEXT)
  })

  it('p3 prompts/get backlog_sync {projectName, cycleName} — 접두줄 순서·값 그대로 + 본문', async () => {
    const result = await getPrompt(token, 'backlog_sync', { projectName: 'hns-p1', cycleName: 'hns-c1' })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.text).toBe(`[인자] projectName=hns-p1 cycleName=hns-c1\n\n${BACKLOG_SYNC_TEXT}`)
  })

  it('p4 prompts/get make_cc_prompt 무인자 — 본문 상수와 완전일치', async () => {
    const result = await getPrompt(token, 'make_cc_prompt')
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.text).toBe(MAKE_CC_PROMPT_TEXT)
  })

  it('p5 prompts/get make_cc_prompt {projectName, targets, cycleName} — 접두줄 순서·값 그대로 + 본문', async () => {
    const result = await getPrompt(token, 'make_cc_prompt', {
      projectName: 'hns-p2',
      targets: 'hns-t1,hns-t2',
      cycleName: 'hns-c2',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.text).toBe(
      `[인자] projectName=hns-p2 targets=hns-t1,hns-t2 cycleName=hns-c2\n\n${MAKE_CC_PROMPT_TEXT}`,
    )
  })

  it('p9 prompts/get backlog_sync {projectName만} — 준 인자만 접두줄에 포함', async () => {
    const result = await getPrompt(token, 'backlog_sync', { projectName: 'hns-p3' })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.text).toBe(`[인자] projectName=hns-p3\n\n${BACKLOG_SYNC_TEXT}`)
  })

  it('p6 prompts/get 없는 이름 — -32602', async () => {
    const result = await getPrompt(token, 'hns-none')
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.error.code).toBe(-32602)
  })

  it('p7 미인증 prompts/list — 401 (경계는 표면 등록보다 앞 계층, red에서도 통과)', async () => {
    const res = await rpc(null, 'prompts/list')
    expect(res.status).toBe(401)
  })

  it('p8 Origin 불일치 POST — 403 (red에서도 통과)', async () => {
    const res = await req(token, '/api/mcp', {
      method: 'POST',
      headers: { Origin: 'https://evil.example' },
      body: JSON.stringify({ jsonrpc: '2.0', id: randomUUID(), method: 'prompts/list' }),
    })
    expect(res.status).toBe(403)
  })
})
