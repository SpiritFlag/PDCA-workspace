// Design Ref: §8.4 D-39 — cycles L1 하네스. `app.request()`로 미들웨어→라우트→서비스→scoped→
// 실 dev DB를 전 구간 통과시킨다(2차가 확립한 검증 수준). 정식 유닛 테스트가 아니라 실행 자산.
//
// 실행: `npm run test:l1` — `.env.local`의 DATABASE_URL(Neon **dev** 브랜치)을 주입한다.
//   메인(프로덕션) DB에 대고 실행하지 말 것 — 이 파일은 그 경로를 막지 않는다, 실행자가 지킨다.
// env 없으면 skip: `describe.skipIf(!hasDb)` — DATABASE_URL 미설정 환경(CI 등)에서 실패 대신 건너뜀.
//   기본 `vitest run`(npm test)은 이 파일을 아예 안 잡는다 — vitest.l1.config.ts로 분리 실행.
// 격리: 합성 owner(`hns-owner-*`, 매 실행 randomUUID suffix)로만 읽고 쓴다. ownerId 2단 조인
//   스코프 덕에 실계정 데이터는 조회조차 안 걸린다(V5). 버전 문자열도 `v9.` 대역만 사용.
// 정리: beforeAll에서 이전 실행 잔여물부터 지우고(cleanup 선실행) afterAll에서 다시 지운다 —
//   정리 실패가 다음 실행에 누적되지 않는다(FR-50). `owner_id LIKE 'hns-%'`인 workspaces
//   (cascade로 projects·documents·cycles·backlogItems까지 연쇄 삭제) + api_tokens를 지운다.
// 확장: 새 도메인의 L1을 추가하려면 이 파일의 mintToken/seedWorkspaceProject/cleanup을
//   가져다 쓰고 파일명을 `*.l1.ts`로 두면 된다(예: 다음 사이클의 backlog_reorder 실행 확인).
import { randomUUID } from 'node:crypto'
import { like } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { app } from './app.js'
import { getDb } from './db/client.js'
import { apiTokens, workspaces } from './db/schema.js'
import { createApiToken } from './db/scoped.js'
import { generateToken, hashToken } from './lib/token.js'

const hasDb = !!process.env.DATABASE_URL

async function cleanup() {
  const db = getDb()
  await db.delete(workspaces).where(like(workspaces.ownerId, 'hns-owner-%'))
  await db.delete(apiTokens).where(like(apiTokens.ownerId, 'hns-owner-%'))
}

async function mintToken(ownerId: string, label: string) {
  const token = generateToken()
  await createApiToken(ownerId, label, hashToken(token))
  return token
}

async function req(token: string | null, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body) headers.set('Content-Type', 'application/json')
  return app.request(path, { ...init, headers })
}

// Response.json()이 unknown을 반환 — 하네스 전용 캐스팅 헬퍼 (프로덕션 코드는 이 패턴을 쓰지 않는다)
async function body<T = Record<string, unknown>>(res: Response): Promise<{ data: T }> {
  return (await res.json()) as { data: T }
}
async function errBody(
  res: Response,
): Promise<{ error: { code: string; details?: Record<string, unknown> } }> {
  return (await res.json()) as { error: { code: string; details?: Record<string, unknown> } }
}

async function seedWorkspaceProject(token: string, tag: string) {
  const wsRes = await req(token, '/api/workspaces', {
    method: 'POST',
    body: JSON.stringify({ name: `hns-ws-${tag}`, slug: `hns-ws-${tag}` }),
  })
  const { data: ws } = await body<{ id: string }>(wsRes)
  const projRes = await req(token, `/api/workspaces/${ws.id}/projects`, {
    method: 'POST',
    body: JSON.stringify({ name: `hns-proj-${tag}`, slug: `hns-proj-${tag}` }),
  })
  const { data: project } = await body<{ id: string }>(projRes)
  return { workspaceId: ws.id, projectId: project.id }
}

describe.skipIf(!hasDb)('cycles L1 (실 dev DB)', () => {
  const RUN = randomUUID().slice(0, 8)
  const OWNER_A = `hns-owner-a-${RUN}`
  const OWNER_B = `hns-owner-b-${RUN}`

  let tokenA: string
  let tokenB: string
  let projectA: string

  beforeAll(async () => {
    await cleanup() // 이전 실행 잔여물 선제거 — 정리 실패 누적 방지(FR-50)
    tokenA = await mintToken(OWNER_A, 'hns-l1-a')
    tokenB = await mintToken(OWNER_B, 'hns-l1-b') // #2 전용 — B는 프로젝트를 안 만든다, A의 프로젝트에 접근 시도만 한다
    ;({ projectId: projectA } = await seedWorkspaceProject(tokenA, 'a'))
    // #11의 "문서는 잔존" 확인용 — cycles와 documents는 FK 없이 독립이라 시드만 있으면 된다
    await req(tokenA, `/api/projects/${projectA}/documents`, {
      method: 'POST',
      body: JSON.stringify({
        title: 'hns-doc',
        path: 'docs/hns/probe.md',
        kind: 'general',
        content: 'probe',
      }),
    })
  })

  afterAll(cleanup)

  // ── #1~#11: Plan §1.3.2 / Design §8.3 원 시나리오 ──

  it('#1 미인증 GET cycles → 401', async () => {
    const res = await req(null, `/api/projects/${projectA}/cycles`)
    expect(res.status).toBe(401)
    expect((await errBody(res)).error.code).toBe('UNAUTHORIZED')
  })

  it('#2 타인(B) 프로젝트 cycles 조회 → 404', async () => {
    const res = await req(tokenB, `/api/projects/${projectA}/cycles`)
    expect(res.status).toBe(404)
  })

  let cycleUnlinkedId: string
  it('#3 사이클 미연결 버전 생성 → 201, name·yearMonth null', async () => {
    const res = await req(tokenA, `/api/projects/${projectA}/cycles`, {
      method: 'POST',
      body: JSON.stringify({ version: 'v9.0.1' }),
    })
    expect(res.status).toBe(201)
    const { data } = await body<{ id: string; name: string | null; yearMonth: string | null }>(res)
    expect(data.name).toBeNull()
    expect(data.yearMonth).toBeNull()
    cycleUnlinkedId = data.id
  })

  let cycleLinkedId: string
  it('#4 사이클 연결 버전 생성 → 201, 둘 다 저장', async () => {
    const res = await req(tokenA, `/api/projects/${projectA}/cycles`, {
      method: 'POST',
      body: JSON.stringify({ version: 'v9.0.2', name: 'hns-cycle-a', yearMonth: '2026-08' }),
    })
    expect(res.status).toBe(201)
    const { data } = await body<{ id: string; name: string | null; yearMonth: string | null }>(res)
    expect(data.name).toBe('hns-cycle-a')
    expect(data.yearMonth).toBe('2026-08')
    cycleLinkedId = data.id
  })

  it('#5 [RED] name만 단독 PATCH → 400 기대 (I-1 재현)', async () => {
    // Decision: [Do] 이 시나리오를 cycleLinkedId(#4)에 직접 걸면, 현행(pre-fix) 스키마가
    // 편측 패치를 실제로 통과시켜 그 레코드의 name을 진짜로 바꿔버린다 — 그 오염이 #7·n1·n2·n4까지
    // 번지는 것을 실행 후 발견했다(red 1회차). 이 시나리오만 전용 레코드로 격리해 부작용을 차단한다.
    const seed = await req(tokenA, `/api/projects/${projectA}/cycles`, {
      method: 'POST',
      body: JSON.stringify({ version: 'v9.0.7', name: 'hns-cycle-i1', yearMonth: '2026-08' }),
    })
    const { data: cycle } = await body<{ id: string }>(seed)
    const res = await req(tokenA, `/api/cycles/${cycle.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'hns-renamed' }),
    })
    expect(res.status).toBe(400)
  })

  it('#6 같은 version 재생성 → 409 target:version', async () => {
    const res = await req(tokenA, `/api/projects/${projectA}/cycles`, {
      method: 'POST',
      body: JSON.stringify({ version: 'v9.0.1' }),
    })
    expect(res.status).toBe(409)
    expect((await errBody(res)).error.details?.target).toBe('version')
  })

  it('#7 같은 name 재생성 → 409 target:name', async () => {
    const res = await req(tokenA, `/api/projects/${projectA}/cycles`, {
      method: 'POST',
      body: JSON.stringify({ version: 'v9.0.3', name: 'hns-cycle-a', yearMonth: '2026-08' }),
    })
    expect(res.status).toBe(409)
    expect((await errBody(res)).error.details?.target).toBe('name')
  })

  it('#8 잘못된 버전 형식 → 400', async () => {
    const res = await req(tokenA, `/api/projects/${projectA}/cycles`, {
      method: 'POST',
      body: JSON.stringify({ version: '9.0.4' }),
    })
    expect(res.status).toBe(400)
  })

  it('#9 한글 사이클명 → 400', async () => {
    const res = await req(tokenA, `/api/projects/${projectA}/cycles`, {
      method: 'POST',
      body: JSON.stringify({ version: 'v9.0.5', name: '한글이름', yearMonth: '2026-08' }),
    })
    expect(res.status).toBe(400)
  })

  it('#10 [RED] PATCH로 연결 해제 → 200 기대 (C-1 재현)', async () => {
    const res = await req(tokenA, `/api/cycles/${cycleLinkedId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: null, yearMonth: null }),
    })
    expect(res.status).toBe(200)
  })

  it('#11 DELETE 후 재조회 → 목록에서 소실, 문서는 잔존', async () => {
    const del = await req(tokenA, `/api/cycles/${cycleUnlinkedId}`, { method: 'DELETE' })
    expect(del.status).toBe(204)
    const list = await req(tokenA, `/api/projects/${projectA}/cycles`)
    const { data } = await body<Array<{ id: string }>>(list)
    expect(data.some((c) => c.id === cycleUnlinkedId)).toBe(false)
    const docs = await req(tokenA, `/api/projects/${projectA}/documents`)
    const { data: docData } = await body<Array<{ path: string }>>(docs)
    expect(docData.some((d) => d.path === 'docs/hns/probe.md')).toBe(true)
  })

  // ── n1~n4: Plan §1.3.2 신규 — C-1·I-1의 회귀 고정 (전부 #10에 종속하거나 #5와 대칭) ──

  it('n1 [RED, #10 종속] 해제 후 재조회 → name·yearMonth 둘 다 null', async () => {
    // Design Ref: §4.1 — cycleItemRoute에 단건 GET이 없으므로 목록에서 찾는다
    const list = await req(tokenA, `/api/projects/${projectA}/cycles`)
    const { data } = await body<Array<{ id: string; name: string | null; yearMonth: string | null }>>(
      list,
    )
    const found = data.find((c) => c.id === cycleLinkedId)
    expect(found?.name).toBeNull()
    expect(found?.yearMonth).toBeNull()
  })

  it('n2 [RED, #10 종속] 해제된 이름을 다른 버전에 부여 → 201 (409 아님)', async () => {
    const res = await req(tokenA, `/api/projects/${projectA}/cycles`, {
      method: 'POST',
      body: JSON.stringify({ version: 'v9.0.6', name: 'hns-cycle-a', yearMonth: '2026-08' }),
    })
    expect(res.status).toBe(201)
  })

  it('n3 [RED, #5 대칭] yearMonth만 단독 PATCH → 400 기대', async () => {
    // Decision: [Do] #5와 같은 이유로 전용 레코드 격리 — 대상은 §5(원안)의 cycleUnlinkedId가
    // 아니다(#11에서 이미 DELETE돼 404가 나므로 시나리오 의미가 깨진다).
    const seed = await req(tokenA, `/api/projects/${projectA}/cycles`, {
      method: 'POST',
      body: JSON.stringify({ version: 'v9.0.8', name: 'hns-cycle-i2', yearMonth: '2026-08' }),
    })
    const { data: cycle } = await body<{ id: string }>(seed)
    const res = await req(tokenA, `/api/cycles/${cycle.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ yearMonth: '2026-09' }),
    })
    expect(res.status).toBe(400)
  })

  it('n4 releaseNote 단독 PATCH → 200, name·yearMonth 유지 (무회귀)', async () => {
    const res = await req(tokenA, `/api/cycles/${cycleLinkedId}`, {
      method: 'PATCH',
      body: JSON.stringify({ releaseNote: 'hns note' }),
    })
    // n2가 이름을 재사용해도 cycleLinkedId 레코드 자체는 해제 상태(name:null) 그대로다
    expect(res.status).toBe(200)
    const { data } = await body<{ releaseNote: string; name: string | null; yearMonth: string | null }>(
      res,
    )
    expect(data.releaseNote).toBe('hns note')
    expect(data.name).toBeNull()
    expect(data.yearMonth).toBeNull()
  })
})
