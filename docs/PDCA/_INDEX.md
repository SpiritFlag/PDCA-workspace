# PDCA Index

| Feature | Match Rate | 완료일 | Documents |
|---------|:----------:|--------|-----------|
| [PDCA-workspace](2026-08/PDCA-workspace/) | 87% | 2026-08-07 | plan, design, analysis, report — **최초 사이클**. Workspace>Project>Document 3계층 웹앱. 핵심 설계는 URL 경로 미러링(D-13)으로 링크 resolver 없이 브라우저 상대 URL 해석에 위임 — cogmo-report 실문서 67개 임포트로 링크 4종(형제/타폴더/디렉터리/레포외부) 전부 실증(C6, 이 사이클의 관문). 4세션(module-1~4)에 걸쳐 매 배치 실배포+curl 자체검증을 병행해 로컬 테스트로는 안 잡히는 배포 버그 6건(Vercel alias 미해석, zod 런타임 에러로 API 전체 다운, Vercel Vite 프리셋의 다단 API 경로 404, SPA 폴백이 정적자산 삼킴, postgres 유니크 위반 500, 전역 onError가 인증 401 삼킴)을 그 자리에서 발견·수정. Check 단계 gap-detector 정적분석에서 서버 재정규화 누락(Critical) 발견해 즉시 수정·재실증. Match Rate 87%(Critical 수정 후, Important 4건·Minor 12건은 형 판단으로 백로그) |
