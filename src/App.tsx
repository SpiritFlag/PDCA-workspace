import { RouterProvider } from 'react-router-dom'
import { AppProviders } from './app/providers'
import { router } from './app/router'
import { authClient } from '@/lib/auth'
import { LoginForm } from '@/features/auth/components/LoginForm'

function AuthGate() {
  const { data: session, isPending, refetch } = authClient.useSession()

  if (isPending) {
    return <main className="min-h-screen" />
  }
  if (!session) {
    return <LoginForm onSuccess={() => refetch()} />
  }
  return <RouterProvider router={router} />
}

function App() {
  return (
    <AppProviders>
      <AuthGate />
    </AppProviders>
  )
}

export default App
