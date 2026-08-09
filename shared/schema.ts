// Design Ref: §4 API Specification — 서버 검증과 클라이언트 폼이 공유하는 zod 스키마 (D-14)
import { z } from 'zod'

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'slug는 소문자·숫자·하이픈만 가능합니다'),
  description: z.string().max(2000).optional(),
})
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>

export const updateWorkspaceSchema = createWorkspaceSchema.partial()
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>

export const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'slug는 소문자·숫자·하이픈만 가능합니다'),
  serviceUrl: z.url().optional().or(z.literal('')),
  githubUrl: z.url().optional().or(z.literal('')),
  githubBranch: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
})
export type CreateProjectInput = z.infer<typeof createProjectSchema>

export const updateProjectSchema = createProjectSchema.partial()
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>

export const documentKindSchema = z.enum(['pdca', 'general'])
export const pdcaStageSchema = z.enum(['plan', 'design', 'analysis', 'report'])

// Design Ref: §3.2 — MCP document_write가 재사용(D-26). 서버가 normalizePath로 재정규화하므로
// path는 여기서 형태만 검증
export const documentPathSchema = z.string().min(1).max(1000)
export const documentTitleSchema = z.string().min(1).max(300)
export const documentContentSchema = z.string().min(1)

// Design Ref: §4.2 — createDocumentSchema의 refine 술어. MCP document_write가 이름 붙여 재사용(D-26)
export const documentKindStageRule = (v: { kind: string; pdcaStage?: string }) =>
  v.kind === 'pdca' || v.pdcaStage === undefined
export const DOCUMENT_KIND_STAGE_MESSAGE = "kind가 'general'이면 pdcaStage를 지정할 수 없습니다"

// zod v4: .refine()이 붙은 스키마엔 .partial()을 쓸 수 없다 — 필드 정의와 refine을 분리한다
export const documentFields = z.object({
  title: documentTitleSchema,
  path: documentPathSchema,
  kind: documentKindSchema,
  pdcaStage: pdcaStageSchema.optional(),
  content: documentContentSchema,
})

export const createDocumentSchema = documentFields.refine(documentKindStageRule, {
  message: DOCUMENT_KIND_STAGE_MESSAGE,
  path: ['pdcaStage'],
})
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>

export const updateDocumentSchema = documentFields.partial()
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>

export const resolveLinksSchema = z.object({
  paths: z.array(z.string().min(1)).max(500),
})

// Design Ref: §3.1·§4.1 — 백로그 zod 스키마. F7 패턴(필드 정의/refine 분리)을 따른다.
export const backlogPrioritySchema = z.enum(['urgent', 'high', 'medium', 'low'])
export type BacklogPriority = z.infer<typeof backlogPrioritySchema>
export const backlogStatusSchema = z.enum(['todo', 'doing', 'done', 'resolved', 'dropped'])

// Design Ref: §3.2 — MCP 툴 입력이 이 스키마들을 재사용한다(2차 회고 Try 2의 규약화, refine-mcp-hardening §8.2)
export const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식이어야 합니다')
export const backlogTitleSchema = z.string().min(1).max(300)
export const backlogDetailSchema = z.string().max(20000)

export const createBacklogItemSchema = z.object({
  title: backlogTitleSchema,
  priority: backlogPrioritySchema,
  detail: backlogDetailSchema.optional(),
  openedOn: dateStringSchema,
})
export type CreateBacklogItemInput = z.infer<typeof createBacklogItemSchema>

// Design Ref: §3.2 — closedOn nullable(D-20). null=명시적으로 지움, 키 생략=변경 없음(무회귀)
const backlogItemFields = z.object({
  title: backlogTitleSchema,
  priority: backlogPrioritySchema,
  status: backlogStatusSchema,
  detail: backlogDetailSchema.optional(),
  openedOn: dateStringSchema,
  closedOn: dateStringSchema.nullable().optional(),
})

export const updateBacklogItemSchema = backlogItemFields.partial()
export type UpdateBacklogItemInput = z.infer<typeof updateBacklogItemSchema>

export const reorderBacklogSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(1000),
})
export type ReorderBacklogInput = z.infer<typeof reorderBacklogSchema>

// 버전(release) — version이 프로젝트 내 유일키. 릴리즈노트(마크다운)를 갖고,
// 선택적으로 PDCA 사이클(name+yearMonth)을 하나 연결한다(연결 없는 버전도 허용).
// 사이클 연결 시 문서 경로: docs/PDCA/{yearMonth}/{name}/{name}.{stage}.md
export const cycleVersionSchema = z
  .string()
  .regex(/^v\d+\.\d+\.\d+$/, '버전은 v0.1.0 형식이어야 합니다')
export const yearMonthSchema = z.string().regex(/^\d{4}-\d{2}$/, 'YYYY-MM 형식이어야 합니다')
export const cycleNameSchema = z
  .string()
  .min(1)
  .max(100)
  // 경로 세그먼트로 쓰이므로 영문·숫자·._- 만 허용(공백·슬래시 금지)
  .regex(/^[A-Za-z0-9._-]+$/, '사이클명은 영문·숫자·._- 만 가능합니다')

// zod v4: refine이 붙은 스키마엔 partial()을 못 쓰므로 필드 정의/refine을 분리한다
// Design Ref: §3.2 — name/yearMonth nullable(D-31a: create/update가 이 필드를 공유하고
// CycleForm이 createCycleSchema를 resolver로 쓰므로 공유 필드에 넣는다, V2 실측).
// null 쌍 = 연결 해제(update) 또는 미연결 생성(create, FR-41).
const cycleFields = z.object({
  version: cycleVersionSchema,
  releaseNote: z.string().max(50000).optional(),
  name: cycleNameSchema.nullable().optional(),
  yearMonth: yearMonthSchema.nullable().optional(),
})

// Design Ref: §3.2 D-38 — 엄격 pair 술어. null(해제)과 undefined(무변경)를 구분한다.
// 느슨한 `== null` 동치 비교는 {name:null} 편측 패치를 통과시켜 병합 부정합을 만든다(V1 반례).
export const cyclePairRule = (v: { name?: string | null; yearMonth?: string | null }) =>
  (v.name === undefined) === (v.yearMonth === undefined) &&
  (v.name === null) === (v.yearMonth === null)
export const CYCLE_PAIR_MESSAGE =
  'PDCA 사이클 연결·해제에는 사이클명과 연월이 함께 있어야 합니다 (해제는 둘 다 null)'

export const createCycleSchema = cycleFields.refine(cyclePairRule, {
  message: CYCLE_PAIR_MESSAGE,
  path: ['name'],
})
export type CreateCycleInput = z.infer<typeof createCycleSchema>

// Design Ref: §3.2 — I-1 폐쇄 지점. partial() 뒤 refine 재부착(refined 스키마엔 partial 불가).
export const updateCycleSchema = cycleFields.partial().refine(cyclePairRule, {
  message: CYCLE_PAIR_MESSAGE,
  path: ['name'],
})
export type UpdateCycleInput = z.infer<typeof updateCycleSchema>

// Design Ref: §3.2 — PAT 발급 요청. name만 입력받는다(D-04: 평문은 발급 응답에만 존재).
export const createApiTokenSchema = z.object({
  name: z.string().min(1).max(100),
})
export type CreateApiTokenInput = z.infer<typeof createApiTokenSchema>
