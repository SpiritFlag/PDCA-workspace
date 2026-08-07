// Design Ref: §9.1 — Vercel이 규약으로 서버리스 함수로 인식하는 유일한 위치. 로직 0, export만.
import { handle } from 'hono/vercel'
import { app } from '../server/app.js'

export const GET = handle(app)
export const POST = handle(app)
export const PATCH = handle(app)
export const DELETE = handle(app)
