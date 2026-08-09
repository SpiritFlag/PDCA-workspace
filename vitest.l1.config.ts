// Design Ref: §8.4 D-39 — L1 하네스(server/**/*.l1.ts) 전용 실행 설정.
// 기본 vitest.config.ts와 include만 다르다 — 기본 `npm test`가 이 파일을 안 잡게 분리한다(F40①).
// Decision: [Do] 6차 module-1 — `.l1.ts` 파일이 2개(cycles·mcp)가 되면서 vitest 기본 파일 간
// 병렬 실행이 실 DB 경합을 냈다. 둘 다 `hns-owner-%` cleanup 이름공간을 공유하는데(l1-harness.js
// 골격의 전제), 병렬 실행 시 한 파일의 beforeAll cleanup이 다른 파일이 쓰고 있는 데이터를 지웠다.
// fileParallelism: false로 파일을 순차 실행해 해소 — 5차는 파일이 1개뿐이라 드러나지 않았던 문제.
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
    fileParallelism: false,
  },
})
