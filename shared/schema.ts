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

// zod v4: .refine()이 붙은 스키마엔 .partial()을 쓸 수 없다 — 필드 정의와 refine을 분리한다
const documentFields = z.object({
  title: z.string().min(1).max(300),
  // Design Ref: §3.2 — 서버가 normalizePath로 재정규화하므로 여기서는 형태만 검증
  path: z.string().min(1).max(1000),
  kind: documentKindSchema,
  pdcaStage: pdcaStageSchema.optional(),
  content: z.string().min(1),
})

export const createDocumentSchema = documentFields.refine(
  (v) => v.kind === 'pdca' || v.pdcaStage === undefined,
  { message: "kind가 'general'이면 pdcaStage를 지정할 수 없습니다", path: ['pdcaStage'] },
)
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

const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식이어야 합니다')

export const createBacklogItemSchema = z.object({
  title: z.string().min(1).max(300),
  priority: backlogPrioritySchema,
  detail: z.string().max(20000).optional(),
  openedOn: dateStringSchema,
})
export type CreateBacklogItemInput = z.infer<typeof createBacklogItemSchema>

const backlogItemFields = z.object({
  title: z.string().min(1).max(300),
  priority: backlogPrioritySchema,
  status: backlogStatusSchema,
  detail: z.string().max(20000).optional(),
  openedOn: dateStringSchema,
  closedOn: dateStringSchema.optional(),
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
const cycleFields = z.object({
  version: cycleVersionSchema,
  releaseNote: z.string().max(50000).optional(),
  name: cycleNameSchema.optional(),
  yearMonth: yearMonthSchema.optional(),
})

// PDCA 사이클을 연결하려면 name·yearMonth가 함께 있어야 한다(둘 다 없으면 사이클 없는 버전)
const cyclePairRule = (v: { name?: string; yearMonth?: string }) =>
  (v.name === undefined) === (v.yearMonth === undefined)

export const createCycleSchema = cycleFields.refine(cyclePairRule, {
  message: 'PDCA 사이클 연결에는 사이클명과 연월이 모두 필요합니다',
  path: ['name'],
})
export type CreateCycleInput = z.infer<typeof createCycleSchema>

export const updateCycleSchema = cycleFields.partial()
export type UpdateCycleInput = z.infer<typeof updateCycleSchema>

// Design Ref: §3.2 — PAT 발급 요청. name만 입력받는다(D-04: 평문은 발급 응답에만 존재).
export const createApiTokenSchema = z.object({
  name: z.string().min(1).max(100),
})
export type CreateApiTokenInput = z.infer<typeof createApiTokenSchema>
