// Design Ref: §7.4 — server/lib/path.ts를 클라이언트에서도 쓰기 위한 재노출.
// 순수 모듈이라 브라우저 번들에 포함돼도 안전하다 (server 런타임 전용 alias 문제와 무관).
export { classifyLink, normalizePath, resolveRelative } from '@server/lib/path'
export type { LinkClass } from '@server/lib/path'
