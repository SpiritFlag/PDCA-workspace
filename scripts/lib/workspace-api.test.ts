// Design Ref: §8.2 — parseToolEnvelope (w1~w4). server/l1-harness.ts callTool과 같은 해석 규칙.
import { describe, expect, it } from 'vitest'
import { parseToolEnvelope } from './workspace-api'

describe('parseToolEnvelope', () => {
  it('w1: 정상 봉투(content[0].text가 JSON)는 ok + 파싱된 data', () => {
    const json = {
      result: { content: [{ type: 'text', text: '{"replaced":true,"previousLength":42}' }] },
    }
    expect(parseToolEnvelope(json)).toEqual({ ok: true, data: { replaced: true, previousLength: 42 } })
  })

  it('w2: isError:true + 텍스트는 ok:false + errorText', () => {
    const json = {
      result: { content: [{ type: 'text', text: '[NOT_FOUND] 문서를 찾을 수 없습니다' }], isError: true },
    }
    expect(parseToolEnvelope(json)).toEqual({ ok: false, errorText: '[NOT_FOUND] 문서를 찾을 수 없습니다' })
  })

  it('w3: JSON-RPC error 필드는 ok:false', () => {
    const json = { error: { message: 'Invalid params' } }
    expect(parseToolEnvelope(json)).toEqual({ ok: false, errorText: 'Invalid params' })
  })

  it('w4: text가 비JSON 문자열이면 ok + 원문 문자열', () => {
    const json = { result: { content: [{ type: 'text', text: 'plain text response' }] } }
    expect(parseToolEnvelope(json)).toEqual({ ok: true, data: 'plain text response' })
  })
})
