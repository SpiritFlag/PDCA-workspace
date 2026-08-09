// Design Ref: §2.2 실행 흐름, §5.1 출력 사양, §6 에러 처리 — CLI 조립.
// 파싱·해석 로직은 두지 않는다(순수 함수는 scripts/lib/*와 cyclePath.ts에 있다, D-65).
// 존재 이유: 사이클 종료 시 클로드가 MCP document_write를 직접 호출하면 문서 본문을
// 출력 토큰으로 재타이핑해야 한다. 이 스크립트는 파일을 그대로 읽어 보내 본문이
// LLM 컨텍스트를 통과하지 않게 한다(FR-75).
// Plan SC: C26~C29 — 본문 무경유(C26) + 이번 사이클(C27)·이전 사이클 사후개정(C29) 동시 반영.
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { parseCycleStagePath } from '../src/features/cycle/lib/cyclePath.ts'
import type { ParsedCyclePath } from '../src/features/cycle/lib/cyclePath.ts'
import { GitDetectionError, detectChangedDocs } from './lib/git-changes.ts'
import type { ChangedPath } from './lib/git-changes.ts'
import { callTool, createCycle, resolveProjectId } from './lib/workspace-api.ts'
import type { Api } from './lib/workspace-api.ts'

const DEFAULT_BASE_URL = 'https://pdca-workspace.vercel.app'
const REPO_ROOT = path.resolve(import.meta.dirname, '..')

const USAGE =
  'usage: npm run docs:upload -- [--cycle <이름>] [--version vX.Y.Z] [--all] [--project <uuid>] [--base-url <url>]'

class UsageError extends Error {}

function fail(message: string): never {
  throw new UsageError(message)
}

// ── 인자 파싱 ────────────────────────────────────────────────────────────────

type Args = { cycle?: string; version?: string; all: boolean; project?: string; baseUrl?: string }

function requireValue(argv: string[], index: number, flag: string): string {
  const value = argv[index]
  if (!value || value.startsWith('--')) fail(`${flag} 에 값이 필요합니다\n${USAGE}`)
  return value
}

function parseArgs(argv: string[]): Args {
  const args: Args = { all: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '--cycle':
        args.cycle = requireValue(argv, ++i, arg)
        break
      case '--version':
        args.version = requireValue(argv, ++i, arg)
        break
      case '--all':
        args.all = true
        break
      case '--project':
        args.project = requireValue(argv, ++i, arg)
        break
      case '--base-url':
        args.baseUrl = requireValue(argv, ++i, arg)
        break
      default:
        fail(`알 수 없는 옵션: ${arg}\n${USAGE}`)
    }
  }
  if (args.version && !/^v\d+\.\d+\.\d+$/.test(args.version)) {
    fail(`--version은 v0.1.0 형식이어야 합니다: ${args.version}`)
  }
  // D-64 — 버전에 연결할 사이클을 자동 추론하지 않는다(변경분에 여러 사이클이 섞이는 게 정상 상태).
  if (args.version && !args.cycle) {
    fail(`--version은 --cycle과 함께 지정해야 합니다\n${USAGE}`)
  }
  return args
}

// ── --all 모드: git 없이 docs/PDCA 전체 스캔 ─────────────────────────────────

async function scanAllDocs(repoRoot: string): Promise<ChangedPath[]> {
  const root = path.join(repoRoot, 'docs/PDCA')
  const out: ChangedPath[] = []
  async function walk(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) await walk(full)
      else if (entry.name.endsWith('.md')) out.push({ path: path.relative(repoRoot, full), kind: 'modified' })
    }
  }
  await walk(root)
  return out
}

// ── 대상 선정 ────────────────────────────────────────────────────────────────

type UploadTarget = { path: string; parsed: ParsedCyclePath }

// FR-78(역파싱 실패는 사유와 함께 건너뜀) · FR-88(삭제·rename은 경고만, 서버 요청 없음)
function selectTargets(changes: ChangedPath[], cycleFilter?: string): UploadTarget[] {
  const targets: UploadTarget[] = []
  for (const change of changes) {
    if (change.kind === 'deleted') {
      console.log(`  warn  삭제 감지: ${change.path} — 서버는 지우지 않음`)
      continue
    }
    if (change.kind === 'renamed') {
      console.log(`  warn  rename 감지: ${change.renamedFrom} → ${change.path} — 서버는 지우지 않음`)
      continue
    }
    const parsed = parseCycleStagePath(change.path)
    if (!parsed) {
      console.log(`  skip  ${change.path} — 사이클 경로 아님`)
      continue
    }
    if (cycleFilter && parsed.name !== cycleFilter) continue
    targets.push({ path: change.path, parsed })
  }
  return targets
}

// D-64 — 연월은 --cycle과 일치하는 변경 문서의 파서 결과에서 얻는다. 두 연월에 걸쳐
// 있으면 모호하므로 중단한다(자동 선택하지 않음).
function resolveCycleYearMonth(targets: UploadTarget[], cycleName: string): string {
  const months = new Set(targets.filter((t) => t.parsed.name === cycleName).map((t) => t.parsed.yearMonth))
  if (months.size === 0) {
    fail(`--cycle ${cycleName}에 해당하는 변경 문서를 찾을 수 없어 연월을 알 수 없습니다`)
  }
  if (months.size > 1) {
    fail(`--cycle ${cycleName}이 여러 연월(${[...months].join(', ')})에 걸쳐 있어 모호합니다`)
  }
  return [...months][0]
}

// ── 메인 ────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const pat = process.env.PDCAW_PAT
  if (!pat) {
    fail(
      'PDCAW_PAT가 설정되지 않았습니다.\n' +
        '  1) 웹 UI의 /tokens 에서 PAT를 발급하고 (평문은 발급 직후 1회만 표시됨)\n' +
        '  2) .env.local 에 PDCAW_PAT=pdcaw_... 로 추가하세요.\n' +
        '  주의: PAT는 서버(=Neon 브랜치)별로 다릅니다 — 붙는 서버에서 발급한 것을 쓰세요.',
    )
  }

  const api: Api = {
    baseUrl: (args.baseUrl ?? process.env.PDCAW_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, ''),
    pat,
  }
  console.log(`→ ${api.baseUrl}`)

  let baseTag: string | undefined
  let changes: ChangedPath[]
  if (args.all) {
    changes = await scanAllDocs(REPO_ROOT)
  } else {
    try {
      const detected = await detectChangedDocs(REPO_ROOT)
      baseTag = detected.baseTag
      changes = detected.changes
    } catch (err) {
      if (err instanceof GitDetectionError) fail(err.message) // FR-86
      throw err
    }
  }
  console.log(args.all ? '기준: --all (docs/PDCA 전체)' : `기준: ${baseTag} 이후 + 작업트리`)

  const targets = selectTargets(changes, args.cycle)

  // FR-87 — 대상이 0건이면 --version 여부와 무관하게 조용히 성공 종료한다(Design §2.2).
  // I-3: 이전엔 --version이 있으면 계속 진행하도록 예외를 뒀으나, resolveCycleYearMonth가
  // 빈 targets에서는 항상 실패해(연월을 구할 데이터가 없음) 그 경로가 도달 불가능한 죽은
  // 코드였다 — 스펙 그대로 무조건 종료로 되돌린다.
  if (targets.length === 0) {
    console.log('변경된 문서 없음')
    return
  }

  console.log(`대상 ${targets.length}건:`)
  for (const t of targets) console.log(`  ${t.parsed.name}  ${t.parsed.stage}  (${t.path})`)

  const projectId = await resolveProjectId(api, args.project ?? process.env.PDCAW_PROJECT_ID)
  console.log(`project=${projectId}`)

  // D-57 — 사이클 생성이 문서 업로드보다 먼저. 실패해도(409 제외) 문서 업로드는 계속한다
  // (형 결정 3 — "실패하면 수동으로 올리면 되니까").
  if (args.version) {
    const yearMonth = resolveCycleYearMonth(targets, args.cycle!)
    const result = await createCycle(api, projectId, { version: args.version, name: args.cycle!, yearMonth })
    if (result.status === 'created') {
      console.log(`사이클: ${args.version} 생성 (${args.cycle} ${yearMonth} 연결)`)
    } else if (result.status === 'exists') {
      console.log(`사이클: ${args.version} 이미 존재 — 생성 생략`) // D-58, 실패 아님
    } else {
      console.error(`사이클 FAIL: ${result.detail}`)
      process.exitCode = 1
    }
  }

  let created = 0
  let replaced = 0
  let failed = 0
  for (const target of targets) {
    // FR-82 — 파일 하나가 throw해도(네트워크 예외 등) 나머지를 계속 처리한다. callTool은
    // HTTP 실패를 ToolResult로 반환하지만 fetch 자체의 연결 실패(ECONNREFUSED 등)는 throw
    // 하므로, 그 경로까지 파일 단위 실패로 축적하려면 이 catch가 필요하다(I-2).
    try {
      const content = await readFile(path.join(REPO_ROOT, target.path), 'utf-8')
      if (!content.trim()) {
        console.log(`  warn  ${target.path} — 빈 파일, 건너뜀`) // FR-83, exit 무영향
        continue
      }
      const result = await callTool(api, 'document_write', {
        projectId,
        path: target.path,
        title: target.parsed.name, // D-59 — 사이클명 그대로(ImportDialog 현행과 동일)
        kind: 'pdca',
        pdcaStage: target.parsed.stage,
        content,
      })
      if (!result.ok) {
        failed++
        console.error(`  FAIL  ${target.path}\n        ${result.errorText}`) // FR-82
        continue
      }
      const data = result.data as { replaced?: boolean; previousLength?: number }
      if (data.replaced) {
        replaced++
        console.log(`  ok    ${target.path} 덮어씀 (이전 ${data.previousLength ?? 0}자)`)
      } else {
        created++
        console.log(`  ok    ${target.path} 신규`)
      }
    } catch (err) {
      failed++
      console.error(`  FAIL  ${target.path}\n        ${err instanceof Error ? err.message : err}`)
    }
  }

  console.log(`문서: 신규 ${created} / 덮어씀 ${replaced} / 실패 ${failed}`)
  if (failed > 0) process.exitCode = 1
}

main().catch((err) => {
  // UsageError는 사용자 안내라 스택 없이, 그 외는 원인 추적을 위해 그대로 노출한다.
  // 어느 쪽이든 PAT는 등장하지 않는다(FR-84 — workspace-api.ts가 헤더에만 쓰고 로그엔 안 씀).
  console.error(err instanceof UsageError ? err.message : err)
  process.exitCode = 1
})
