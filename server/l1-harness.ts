// Design Ref: §8.4 D-48·D-51 — L1 하네스 공유 골격. 5차 `cycles.l1.ts`의 6함수를 추출하고
// MCP JSON-RPC 헬퍼(rpc·callTool)를 신설한다(FR-72 — 다음 사이클이 이 파일을 확장하면
// RK-32가 말하는 "3번째 재건축"이 일어나지 않는다).
//
// 파일명은 의도적으로 `.l1.ts` 접미사가 **아니다**(RK-31, V3 실측) — `vitest.l1.config.ts`의
// `include:['**/*.l1.ts']`와 기본 `vitest.config.ts` 양쪽 모두 이 파일을 테스트 파일로 수집하지
// 않는다. `server/` 아래라 `tsconfig.server.json` include에는 걸려 `tsc -b`·`oxlint`가 커버한다.
//
// 격리 규칙(5차 그대로 승계): 합성 owner는 `hns-owner-*`, 버전 문자열은 `v9.` 대역만 쓴다.
// `cleanup()`이 owner_id LIKE 'hns-%'인 workspaces(cascade)·api_tokens를 지운다 — 새 도메인이
// 같은 이름공간 규칙을 따르면 이 `cleanup` 하나로 함께 정리된다(mcp.l1.ts의 FX-* 포함).
//
// MCP 시나리오는 `callTool`을 쓴다 — REST용 `req`/`body`/`errBody`와 별개다. `rpc`는 V1
// 실측(2026-08-09)으로 확정된 형태다: `/api/mcp`는 stateless라 `initialize` 선행이 필요 없고
// (세션 없는 단발 tools/call이 그대로 성립), `Accept` 헤더도 불요(`enableJsonResponse: true`가
// JSON 응답을 고정한다) — 필요한 헤더는 Authorization·Content-Type 둘뿐이다.
//
// 확장: 새 도메인의 L1을 추가하려면 이 파일의 함수들을 가져다 쓰고 파일명을 `*.l1.ts`로 두면 된다.
import { randomUUID } from 'node:crypto'
import { like } from 'drizzle-orm'
import { app } from './app.js'
import { getDb } from './db/client.js'
import { apiTokens, workspaces } from './db/schema.js'
import { createApiToken } from './db/scoped.js'
import { generateToken, hashToken } from './lib/token.js'

export const hasDb = !!process.env.DATABASE_URL

export async function cleanup() {
  const db = getDb()
  await db.delete(workspaces).where(like(workspaces.ownerId, 'hns-owner-%'))
  await db.delete(apiTokens).where(like(apiTokens.ownerId, 'hns-owner-%'))
}

export async function mintToken(ownerId: string, label: string) {
  const token = generateToken()
  await createApiToken(ownerId, label, hashToken(token))
  return token
}

export async function req(token: string | null, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body) headers.set('Content-Type', 'application/json')
  return app.request(path, { ...init, headers })
}

// Response.json()이 unknown을 반환 — 하네스 전용 캐스팅 헬퍼 (프로덕션 코드는 이 패턴을 쓰지 않는다)
export async function body<T = Record<string, unknown>>(res: Response): Promise<{ data: T }> {
  return (await res.json()) as { data: T }
}
export async function errBody(
  res: Response,
): Promise<{ error: { code: string; details?: Record<string, unknown> } }> {
  return (await res.json()) as { error: { code: string; details?: Record<string, unknown> } }
}

export async function seedWorkspaceProject(token: string, tag: string) {
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

// Design Ref: §8.4 — MCP JSON-RPC 헬퍼(신설). V1 실측대로 initialize 선행·Accept 헤더 불요.
export async function rpc(token: string | null, method: string, params?: unknown) {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return app.request('/api/mcp', {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: randomUUID(), method, params }),
  })
}

type ToolCallEnvelope = {
  result?: { content: Array<{ type: string; text: string }>; isError?: boolean }
}

/** Design Ref: §8.4 — tools/call 래퍼. isError면 text(예: "[TRANSITION_DENIED] ...")를,
 * 성공이면 content[0].text를 JSON.parse한 data를 돌려준다. */
export async function callTool(token: string | null, name: string, args: Record<string, unknown> = {}) {
  const res = await rpc(token, 'tools/call', { name, arguments: args })
  const httpStatus = res.status
  const json = (await res.json()) as ToolCallEnvelope
  const isError = json.result?.isError ?? false
  const text = json.result?.content?.[0]?.text ?? ''
  if (isError) return { ok: false as const, httpStatus, isError: true as const, text }
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }
  return { ok: true as const, httpStatus, isError: false as const, data }
}

type GetPromptEnvelope = {
  result?: { description?: string; messages: Array<{ role: string; content: { type: string; text: string } }> }
  error?: { code: number; message: string }
}

/** Design Ref: §2.1·§8.2 — prompts/get 래퍼(callTool과 대칭). SDK가 없는 프롬프트명·인자
 * 검증 실패를 JSON-RPC 에러(-32602)로 낸다 — isError 유니온이 아니라 error 필드로 온다.
 * Decision: [Do] 실측(module-1) — argsSchema 필드가 전부 optional이어도 SDK의 z.object()는
 * `arguments` 자체가 undefined면 거부한다("expected object, received undefined"). `args ?? {}`로
 * 항상 객체를 보낸다 — 실제 CC 클라이언트가 무인자 호출 시 필드를 생략하는지는 module-3에서 별도 실증한다. */
export async function getPrompt(token: string | null, name: string, args?: Record<string, string>) {
  const res = await rpc(token, 'prompts/get', { name, arguments: args ?? {} })
  const httpStatus = res.status
  const json = (await res.json()) as GetPromptEnvelope
  if (json.error) return { ok: false as const, httpStatus, error: json.error }
  const text = json.result?.messages[0]?.content.text ?? ''
  return { ok: true as const, httpStatus, text }
}
