// Design Ref: §4.4 — MCP 툴 8개. 쿼리 직접 실행 금지(§9.1) — server/services/*만 호출한다.
// 거부는 isError 툴 결과 + 코드·사유로, 조용한 무시 금지(Plan §7.5).
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import * as workspacesService from '../services/workspaces.js'
import * as projectsService from '../services/projects.js'
import * as documentsService from '../services/documents.js'
import * as backlogService from '../services/backlog.js'
import { ServiceError } from '../lib/errors.js'
import {
  backlogDetailSchema,
  backlogPrioritySchema,
  backlogStatusSchema,
  backlogTitleSchema,
  dateStringSchema,
  documentFields,
  documentKindStageRule,
  documentPathSchema,
  DOCUMENT_KIND_STAGE_MESSAGE,
  reorderBacklogSchema,
} from '../../shared/schema.js'

// Design Ref: §4.2 — id류는 z.uuid() 직접 사용. zod 내장이 단일 원천이라 shared 재정의는 순수 오버헤드

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] }
}

/** Design Ref: §6.2 MCP 어댑터 매핑 — 클로드가 형에게 그대로 전달할 수 있는 문장으로 */
function fail(err: unknown) {
  if (err instanceof ServiceError) {
    return {
      content: [{ type: 'text' as const, text: `[${err.code}] ${err.message || err.code}` }],
      isError: true,
    }
  }
  throw err
}

export function registerTools(server: McpServer, ownerId: string) {
  server.registerTool(
    'project_list',
    { description: '작업을 시작할 때 가장 먼저 호출해 워크스페이스·프로젝트 목록과 id를 확보한다' },
    async () => {
      try {
        const workspaces = await workspacesService.listWorkspaces(ownerId)
        const withProjects = await Promise.all(
          workspaces.map(async (ws) => ({
            ...ws,
            projects: await projectsService.listProjectsInWorkspace(ownerId, ws.id),
          })),
        )
        return ok(withProjects)
      } catch (err) {
        return fail(err)
      }
    },
  )

  server.registerTool(
    'document_list',
    {
      description: '프로젝트의 문서 경로 목록(본문 제외). PDCA 문서를 훑기 전 대상 파악용',
      inputSchema: { projectId: z.uuid() },
    },
    async ({ projectId }) => {
      try {
        return ok(await documentsService.listDocuments(ownerId, projectId))
      } catch (err) {
        return fail(err)
      }
    },
  )

  server.registerTool(
    'document_read',
    {
      description: '경로로 문서 본문을 읽는다. 백로그 판단에 필요한 plan·report 등을 읽을 때',
      inputSchema: { projectId: z.uuid(), path: documentPathSchema },
    },
    async ({ projectId, path }) => {
      try {
        return ok(await documentsService.getDocumentByPath(ownerId, projectId, path))
      } catch (err) {
        return fail(err)
      }
    },
  )

  // Design Ref: §4.2 D-26 — document_write만 refine 포함 객체 전체를 재사용한다. 교차규칙
  // (kind='general'이면 pdcaStage 금지)은 필드 단위로 표현 불가능한 유일한 갭이라 객체 단위가 필요
  const documentWriteSchema = documentFields
    .extend({ projectId: z.uuid() })
    .refine(documentKindStageRule, { message: DOCUMENT_KIND_STAGE_MESSAGE, path: ['pdcaStage'] })

  server.registerTool(
    'document_write',
    {
      description:
        '문서 경로 upsert. 기존 문서가 있으면 덮어쓰며 응답에 replaced·previousLength를 포함한다(RK-03). PDCA 산출물을 워크스페이스에 올릴 때',
      inputSchema: documentWriteSchema,
    },
    async ({ projectId, path, title, kind, pdcaStage, content }) => {
      try {
        return ok(
          await documentsService.upsertDocumentByPath(ownerId, projectId, {
            path,
            title,
            kind,
            pdcaStage,
            content,
          }),
        )
      } catch (err) {
        return fail(err)
      }
    },
  )

  server.registerTool(
    'backlog_list',
    {
      description: '백로그 조회(상태 필터 가능). 정리 작업 전 기존 항목 전체를 파악할 때(기본: 전 상태)',
      inputSchema: { projectId: z.uuid(), status: z.array(backlogStatusSchema).optional() },
    },
    async ({ projectId, status }) => {
      try {
        return ok(await backlogService.listBacklog(ownerId, projectId, status))
      } catch (err) {
        return fail(err)
      }
    },
  )

  server.registerTool(
    'backlog_create',
    {
      description:
        '새 백로그 항목 생성. status는 항상 todo로 시작한다(입력에서 제외). openedOn은 YYYY-MM-DD 형식',
      inputSchema: {
        projectId: z.uuid(),
        title: backlogTitleSchema,
        priority: backlogPrioritySchema,
        detail: backlogDetailSchema.optional(),
        openedOn: dateStringSchema,
      },
    },
    async ({ projectId, title, priority, detail, openedOn }) => {
      try {
        return ok(
          await backlogService.createBacklogItem(ownerId, projectId, { title, priority, detail, openedOn }),
        )
      } catch (err) {
        return fail(err)
      }
    },
  )

  server.registerTool(
    'backlog_update',
    {
      description:
        '항목 갱신. status는 resolved(다른 작업으로 자연 해소됨)·dropped(안 하기로 판단)만 지정 가능 — doing·done은 사용자 전용이라 거부된다(FR-19). 날짜는 YYYY-MM-DD 형식',
      inputSchema: {
        id: z.uuid(),
        title: backlogTitleSchema.optional(),
        priority: backlogPrioritySchema.optional(),
        detail: backlogDetailSchema.optional(),
        openedOn: dateStringSchema.optional(),
        // Design Ref: §4.2 D-21 — 지우기는 형의 정정 행위. shared는 nullable이지만 MCP는 null 배제
        closedOn: dateStringSchema.optional(),
        // Design Ref: §4.4 — 1차 방어: 스키마부터 resolved·dropped로 좁힌다. 2차는 canTransition(서비스, actor='mcp').
        status: z.enum(['resolved', 'dropped']).optional(),
      },
    },
    async ({ id, ...patch }) => {
      try {
        return ok(await backlogService.updateBacklogItem(ownerId, id, patch, 'mcp'))
      } catch (err) {
        return fail(err)
      }
    },
  )

  server.registerTool(
    'backlog_reorder',
    {
      description: '우선순위 재배열이 명시적으로 요청됐을 때만 호출한다. 평소 순서는 사용자가 UI에서 관리한다',
      inputSchema: { projectId: z.uuid(), ids: reorderBacklogSchema.shape.ids },
    },
    async ({ projectId, ids }) => {
      try {
        await backlogService.reorderBacklog(ownerId, projectId, ids)
        return ok({ ok: true })
      } catch (err) {
        return fail(err)
      }
    },
  )
}
