// Design Ref: §6.1 에러 코드 표 — 이후 전 라우트·서비스·툴은 이 코드만 참조. §6.2 ServiceError → 어댑터 매핑
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'TRANSITION_DENIED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL'

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  TRANSITION_DENIED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL: 500,
}

export class ServiceError extends Error {
  code: ErrorCode
  details?: Record<string, unknown>

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message)
    this.code = code
    this.details = details
  }

  get status(): number {
    return STATUS_BY_CODE[this.code]
  }
}
