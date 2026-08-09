// Design Ref: §9.1 — Vercel이 규약으로 서버리스 함수로 인식하는 유일한 위치. 로직 0, export만.
import { handle } from 'hono/vercel'
import { root } from '../server/root.js'

export const GET = handle(root)
export const POST = handle(root)
export const PATCH = handle(root)
export const DELETE = handle(root)
