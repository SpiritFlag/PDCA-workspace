// Design Ref: §2.2 데이터 흐름 — 문서 경로를 URL에 그대로 미러링하는 라우팅.
import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { WorkspaceList } from '@/features/workspace/components/WorkspaceList'
import { ProjectListPage } from '@/features/project/components/ProjectListPage'
import { ProjectOverviewPage } from '@/features/document/components/ProjectOverviewPage'
import { DocumentViewPage } from '@/features/document/components/DocumentViewPage'
import { BacklogPage } from '@/features/backlog/components/BacklogPage'
import { TokensPage } from '@/features/tokens/components/TokensPage'

export const router = createBrowserRouter([
  {
    // Design Ref: §5.4 [module-3] 진입 — 계정 단위 설정이라 /w/... 트리 밖의 최상위 경로
    path: '/settings/tokens',
    element: (
      <AppShell>
        <TokensPage />
      </AppShell>
    ),
  },
  {
    path: '/',
    element: (
      <AppShell>
        <WorkspaceList />
      </AppShell>
    ),
  },
  {
    path: '/w/:wsSlug',
    element: (
      <AppShell>
        <ProjectListPage />
      </AppShell>
    ),
  },
  {
    path: '/w/:wsSlug/p/:projSlug',
    element: (
      <AppShell>
        <ProjectOverviewPage />
      </AppShell>
    ),
  },
  {
    // Design Ref: §5.1 라우팅 — 와일드카드 문서 라우트보다 먼저 매칭돼야 한다(Plan §6 순서 함정).
    path: '/w/:wsSlug/p/:projSlug/backlog',
    element: (
      <AppShell>
        <BacklogPage />
      </AppShell>
    ),
  },
  {
    path: '/w/:wsSlug/p/:projSlug/*',
    element: (
      <AppShell>
        <DocumentViewPage />
      </AppShell>
    ),
  },
])
