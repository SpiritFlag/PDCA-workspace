// Design Ref: §5·§9 D-91(A안: 의미는 backlog_update description을 지목만, shared/ import 0건)·
// D-92(템플릿 리터럴 상수 export — 소비처 2곳: registerPrompts·prompts.l1.ts)·D-97(정적 본문 +
// 인자 접두 에코, {{}} 치환 아님). RK-57 — registerPrompts는 반드시 server.connect() 이전에
// 호출한다(index.ts). 그 이후 호출하면 SDK가 registerCapabilities에서 throw한다.
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export const BACKLOG_SYNC_TEXT = `방금 닫힌 PDCA 사이클을 기준으로 백로그를 최신 상태로 되돌린다. 아래 순서를 그대로 따른다.

0. 대상 확정
   - cycleName이 주어졌으면 그 사이클을 대상으로 한다.
   - 비었으면 cycle_list로 버전 목록을 받아 가장 높은 버전의 name을 후보로 삼고,
     "이번 대상은 <사이클명>이 맞나?"를 한 줄로 확인받은 뒤 진행한다. 추측으로 진행하지 않는다.

1. 근거 읽기
   - document_list로 경로를 확인하고 document_read로 그 사이클의 report를 읽는다.
     판정이 갈리는 항목이 있으면 analysis도 읽는다.
   - backlog_list를 상태 필터 없이(전 상태) 호출해 전건을 확보한다.
     열린 항목만 보면 이미 닫힌 항목과의 중복 생성을 놓친다.

2. 종료 상태 갈라 찍기
   - 이 사이클이 겨냥해서 해결한 항목 → done
   - 의도한 건 아닌데 다른 작업에 딸려 해결됐거나 필요 자체가 없어진 항목 → resolved
   - 두 상태의 정의는 이 서버 backlog_update 툴의 description에 적힌 것을 그대로 따른다.
     여기서 다시 정의하지 않는다.
   - closedOn은 사이클 완료일(YYYY-MM-DD).
   - todo로 되돌리는 전환은 사람 전용이므로 요청하지 않는다.

3. detail 갱신 — 원안 보존
   - 상태를 바꾸거나 범위를 줄일 때 detail 맨 앞에 한 줄 블록을 덧붙인다.
       [YYYY-MM-DD 완료|해소|축소|갱신 — 근거: <사이클명> <SC/FR/§ 번호>]
   - 기존 본문은 지우지 않는다. 원안이 뒤로 밀리면 "(원안)" 접두를 붙여 아래에 남긴다.

4. 신규 항목 생성
   - report의 이월·신규 제안(등급별 이월 · 회고 Try · 다음 사이클 후보)을 각각 항목으로 만든다.
   - 만들기 전에 1단계에서 확보한 전건과 제목·detail을 대조해 이미 있는 항목인지 먼저 확인한다.
     있으면 새로 만들지 말고 그 항목의 detail을 갱신한다.
   - detail에 출처를 반드시 남긴다: (<사이클명> report §<번호>)
   - openedOn은 사이클 완료일. 상태는 항상 todo에서 시작한다.

5. 전제가 바뀐 기존 항목 재평가
   - 이번 사이클로 근거나 범위가 달라진 항목은 상태를 바꾸지 말고 3단계 형식으로
     [… 축소] 또는 [… 갱신]만 기록한다.

6. 판단 보류
   - done인지 resolved인지 갈리는 항목, 여러 건이 묶여 통째로 닫을 수 없는 항목,
     폐기 여부가 사람 결정인 항목은 바꾸지 말고 질문으로 남긴다.

7. 보고
   - 처리 요약 표를 낸다: done / resolved / 신규 / 갱신 각 구획에 항목 제목 한 줄씩.
   - 이어서 보드 집계(상태별 건수)를 낸다.
   - 6단계의 질문이 있으면 표 아래에 번호를 매겨 따로 낸다.`

export const MAKE_CC_PROMPT_TEXT = `백로그 항목을 Claude Code가 바로 실행할 수 있는 "Plan 작성 지시서"로 바꾼다.
결과물은 지시서 텍스트 한 덩어리이며, 이 대화에서 설계나 구현을 시작하지 않는다.

0. 대상 확정
   - targets가 주어졌으면 그것으로 항목을 특정한다(쉼표 구분, 항목 id 또는 제목 일부).
     제목 일부면 backlog_list 결과와 대조해 한 건으로 좁히고, 후보가 여럿이면 되묻는다.
   - 비었으면 backlog_list로 열린 항목을 훑고 우선순위·의존 관계를 근거로 후보를 2~3건
     제시해 형이 고르게 한다. 임의로 정하지 않는다.
   - cycleName이 주어졌으면 그 이름을 쓰고, 비었으면 3번 규칙으로 만들어 제안한다.

1. 근거 확보
   - 대상 항목의 detail을 끝까지 읽는다. detail이 가리키는 문서(report §번호 등)가 있으면
     document_read로 원문까지 확인한다.
   - 백로그 detail의 요약만으로 지시서를 쓰지 않는다.

2. 지시서 구성 — 아래 8개를 모두 포함한다
   1) 산출물 — docs/PDCA/<연월>/<사이클명>/<사이클명>.plan.md 한 개만.
      착수 전 \`git log -1 -- docs/RULE.md\`로 RULE.md 최신 확인 지시.
      템플릿은 직전 사이클 문서 구조를 따르게 한다. 코드 수정 금지, 커밋 금지를 명시한다.
   2) 사이클 목적 — 백로그 항목의 문장을 인용해 "왜 지금 이걸 하는가"를 적는다.
      선행 사이클과의 관계(무엇의 후속인가)가 있으면 함께 적는다.
   3) 스코프 N건 고정 — 항목을 번호로 세고 "확장 금지"를 명시한다.
   4) 명시적 Out of Scope — 인접해서 손대고 싶어질 것들을 미리 열거하고,
      작업 중 발견하면 고치지 말고 백로그로 재이월하라고 지시한다.
   5) 착수 전 실측 표 — 추정 금지. 관련 파일·함수·스키마를 직접 읽어 확정 사실로 적게 한다.
      성패를 가르는 항목에는 ★를 붙이고, 지원 여부가 불확실한 것은
      "지원하지 않으면 우회 비용을 산정해 보고"까지 지시한다.
   6) P-1 표 — 직전 사이클의 Try 이행 현황. 아직 회신되지 않은 채점 항목을 이름으로 지목한다.
   7) Success Criteria — 실증 기준으로 쓰고, 검증 수단(코드 / 브라우저 / 커넥터)을 열로 분류한다.
      사람 손이 필요한 항목의 비율이 높으면 그 사실을 지시서에 미리 적는다.
   8) 끝맺음 — "작성 완료 후 문서 경로만 보고하고, 승인 전에 Design이나 구현에 착수하지 않는다."

3. 사이클명 규칙
   - 동사 어휘 관례를 따른다: refine(이월 마감) · expand(경계·반경 확장) ·
     enhance(기존 기능 개선) · adopt(외부 도입).
   - 형태는 <동사>-<대상>의 케밥 케이스. 날짜와 버전은 넣지 않는다.

4. 주의
   - PAT·토큰·개인정보류를 예시에 넣지 않는다.
   - 지시서는 형이 그대로 복사해 Claude Code에 붙여넣을 수 있어야 한다.
     이 대화에서만 통하는 지시대명사("아까 그거", "위에서 말한 것")를 쓰지 않는다.

5. 출력
   - 지시서 본문만 낸다. 앞뒤 설명은 한 줄 이내로 줄인다.`

/** Design Ref: §5.2 D-97 — 준 인자만, 준 순서대로 'k=v' 공백 join. 무인자면 본문 그대로 반환 */
function withArgsPrefix(text: string, args: Record<string, string | undefined>) {
  const pairs = Object.entries(args).filter((entry): entry is [string, string] => entry[1] !== undefined)
  if (pairs.length === 0) return text
  const prefix = `[인자] ${pairs.map(([k, v]) => `${k}=${v}`).join(' ')}`
  return `${prefix}\n\n${text}`
}

export function registerPrompts(server: McpServer) {
  server.registerPrompt(
    'backlog_sync',
    {
      title: '백로그 최신화',
      description:
        '사이클을 닫은 직후 백로그를 최신 상태로 되돌릴 때. 종료 상태 갈라 찍기 · 이월 항목 생성 · 낡은 항목 재평가를 한 번에 처리한다',
      argsSchema: {
        cycleName: z
          .string()
          .optional()
          .describe(
            '대상 사이클 폴더명. 예: expand-mcp-prompts. 비우면 cycle_list 최고 버전을 후보로 확인받는다',
          ),
      },
    },
    ({ cycleName }) => ({
      messages: [
        {
          role: 'user',
          content: { type: 'text', text: withArgsPrefix(BACKLOG_SYNC_TEXT, { cycleName }) },
        },
      ],
    }),
  )

  server.registerPrompt(
    'make_cc_prompt',
    {
      title: 'CC용 Plan 지시서 생성',
      description:
        '백로그 항목을 Claude Code가 그대로 실행할 수 있는 Plan 작성 지시서로 바꿀 때. 스코프 고정 · 실측 필수 표 · P-1 표 · 승인 대기 끝맺음을 포함해 생성한다',
      argsSchema: {
        targets: z
          .string()
          .optional()
          .describe('쉼표 구분 — 백로그 항목 id 또는 제목 일부. 비우면 후보 2~3건을 제시한다'),
        cycleName: z.string().optional().describe('새 사이클명. 비우면 어휘 관례로 제안한다'),
      },
    },
    ({ targets, cycleName }) => ({
      messages: [
        {
          role: 'user',
          content: { type: 'text', text: withArgsPrefix(MAKE_CC_PROMPT_TEXT, { targets, cycleName }) },
        },
      ],
    }),
  )
}
