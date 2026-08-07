// Design Ref: §6.1 에러 응답 규격 — zValidator의 기본 에러 포맷을 표준 형태로 통일한다.
import { zValidator as zv } from '@hono/zod-validator'
import type { ValidationTargets } from 'hono'
import type { ZodType } from 'zod'

export const zValidator = <T extends ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) =>
  zv(target, schema, (result, c) => {
    if (!result.success) {
      const fieldErrors: Record<string, string[]> = {}
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || '_root'
        ;(fieldErrors[key] ??= []).push(issue.message)
      }
      return c.json(
        { error: { code: 'VALIDATION_ERROR', message: '입력값을 확인해주세요', details: { fieldErrors } } },
        400,
      )
    }
  })
