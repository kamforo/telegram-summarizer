import { Sidebar } from './sidebar'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-white dark:bg-gray-950">
        <div className="container mx-auto p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
