// Design Ref: §8.4 시드 데이터 — cogmo-report docs/ 67개를 실제 경로로 임포트하는 로컬 전용 스크립트.
// Plan SC: C6 실증용. 사용법: node scripts/import-docs.mjs
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const REPO_DIR = '/home/singi/workspace/services/cogmo-report'
const DOCS_DIR = path.join(REPO_DIR, 'docs')
const ORIGIN = 'https://pdca-workspace.vercel.app'
const AUTH_BASE = 'https://ep-damp-boat-aza8e0kl.neonauth.c-3.ap-southeast-1.aws.neon.tech/neondb/auth'
const EMAIL = 'l1-probe@example.com'
const PASSWORD = 'testtest12'
const PROJECT_ID = process.argv[2]

if (!PROJECT_ID) {
  console.error('usage: node scripts/import-docs.mjs <projectId>')
  process.exit(1)
}

async function findMarkdownFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await findMarkdownFiles(full)))
    } else if (entry.name.endsWith('.md')) {
      files.push(full)
    }
  }
  return files
}

function classify(repoRelPath) {
  const base = path.basename(repoRelPath)
  const stageMatch = base.match(/\.(plan|design|analysis|report)\.md$/)
  if (repoRelPath.startsWith('docs/PDCA/') && stageMatch) {
    return { kind: 'pdca', pdcaStage: stageMatch[1] }
  }
  return { kind: 'general', pdcaStage: undefined }
}

async function main() {
  const signInRes = await fetch(`${AUTH_BASE}/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  const cookie = signInRes.headers.get('set-cookie')
  if (!signInRes.ok || !cookie) throw new Error('sign-in failed')

  const tokenRes = await fetch(`${AUTH_BASE}/token`, {
    headers: { Cookie: cookie.split(';')[0], Origin: ORIGIN },
  })
  const { token } = await tokenRes.json()

  const files = await findMarkdownFiles(DOCS_DIR)
  console.log(`found ${files.length} markdown files`)

  let created = 0
  let conflict = 0
  let failed = 0

  for (const file of files) {
    const repoRelPath = path.relative(REPO_DIR, file)
    const content = await readFile(file, 'utf-8')
    const title = path.basename(file)
    const { kind, pdcaStage } = classify(repoRelPath)

    const res = await fetch(`${ORIGIN}/api/projects/${PROJECT_ID}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title, path: repoRelPath, kind, pdcaStage, content }),
    })

    if (res.status === 201) {
      created++
    } else if (res.status === 409) {
      conflict++
    } else {
      failed++
      console.error(`FAILED ${res.status} ${repoRelPath}: ${await res.text()}`)
    }
  }

  console.log(`created=${created} conflict=${conflict} failed=${failed} total=${files.length}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
