// Design Ref: §8.4 D-39 — L1 하네스(server/**/*.l1.ts) 전용 실행 설정.
// 기본 vitest.config.ts와 include만 다르다 — 기본 `npm test`가 이 파일을 안 잡게 분리한다(F40①).
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['**/*.l1.ts'],
  },
})
