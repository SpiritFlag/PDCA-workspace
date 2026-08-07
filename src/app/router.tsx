// Design Ref: §2.2 데이터 흐름 — 문서 경로를 URL에 그대로 미러링하는 라우팅.
import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { WorkspaceList } from '@/features/workspace/components/WorkspaceList'
import { ProjectListPage } from '@/features/project/components/ProjectListPage'
import { ProjectOverviewPage } from '@/features/document/components/ProjectOverviewPage'
import { DocumentViewPage } from '@/features/document/components/DocumentViewPage'

export const router = createBrowserRouter([
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
    path: '/w/:wsSlug/p/:projSlug/*',
    element: (
      <AppShell>
        <DocumentViewPage />
      </AppShell>
    ),
  },
])
