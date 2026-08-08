# 배포 체크리스트

> PDCA 밖 상시 운영 문서. 사이클이 끝나도 이동·삭제하지 않는다(RULE.md — 최상위 주제 디렉터리).
> Vercel(main 브랜치=Production) + Neon(dev/main 두 브랜치) 배포 시 매번 참조한다.
> 근거: [backlog-with-mcp.report.md](../PDCA/2026-08/backlog-with-mcp/backlog-with-mcp.report.md) §5.2·§7.2,
> [refine-mcp-hardening.design.md](../PDCA/2026-08/refine-mcp-hardening/refine-mcp-hardening.design.md) §10.1

---

## 1. 마이그레이션

스키마 변경(`server/db/schema.ts`)이 있는 배포는 **dev·main 두 브랜치 각각** 마이그레이션을
적용해야 한다 — 자동으로 동기화되지 않는다.

```bash
# dev 브랜치 (로컬 개발용)
DATABASE_URL=<dev-branch-url> npx drizzle-kit migrate

# main 브랜치 (프로덕션)
DATABASE_URL=<main-branch-url> npx drizzle-kit migrate
```

**적용 확인**: 새 테이블/컬럼을 쓰는 엔드포인트를 실 요청으로 1회 확인(예: `GET /api/tokens`).

**미적용 시 증상 (실사례, backlog-with-mcp 사이클)**: main 브랜치에 마이그레이션을 안 넣고
배포했더니 `/api/tokens` 500(테이블 없음). Vercel 함수 로그의 `INTERNAL`/스택트레이스로만
드러났다 — 브라우저에서는 그냥 "안 됨"으로만 보인다.

## 2. 배포 순서

**마이그레이션 먼저, 코드 배포는 그다음.** 구코드가 신스키마를 만나는 건 안전(모르는 컬럼은
무시)하지만, 역방향(신코드가 구스키마를 만남)은 즉시 500이다.

1. dev 브랜치 마이그레이션 (로컬 검증용)
2. 로컬에서 `tsc -b` · `oxlint` · `vitest run` 전부 통과 확인
3. main 브랜치 마이그레이션 (스키마 변경이 있을 때만)
4. `git push origin main` → Vercel 자동 배포 (또는 `vercel --prod`)

## 3. 배포 후 확인

| 확인 항목 | 방법 |
|-----------|------|
| 함수가 살아있다 | `GET /api/health` → `{"data":{"status":"ok"}}` |
| 인증이 살아있다 | 인증 필요 경로 1건(예: `GET /api/me`)을 유효 토큰으로 호출 → 200 |
| 이번 배포가 건드린 기능 1회전 | 해당 기능의 최소 시나리오(생성→조회 등) 1회 |
| (스키마 변경 시) 신규 테이블/컬럼 | §1의 "적용 확인" 절차 |

## 4. 롤백 기준

- 배포 직후 §3 확인 중 하나라도 실패 → 이전 배포로 즉시 롤백(`vercel rollback` 또는 이전
  커밋으로 재배포)하고 원인 분석은 로컬/dev에서 진행한다. 프로덕션에서 디버깅하지 않는다.
- 스키마 변경이 배포에 포함된 롤백은 **코드만 롤백하고 마이그레이션은 되돌리지 않는다** —
  구코드가 신스키마를 만나는 방향은 안전(§2)하므로, 컬럼 추가류는 역마이그레이션이 오히려
  위험(진행 중 쓰기와 충돌).

## 5. 알려진 노출면

- **PAT를 `?token=` 쿼리파라미터로 전달하면 Vercel Logs의 Search Params 필드에 평문으로
  남는다** (refine-mcp-hardening 사이클 S3, 2026-08-08 실측 확정). claude.ai 웹 커넥터가
  커스텀 헤더를 지원할 때까지는 감내 중인 알려진 트레이드오프다 — 새로운 문제가 아니다.
