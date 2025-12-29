'use client'

import { DashboardLayout } from '@/components/dashboard/layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-gray-500">Configure your Telegram Summarizer</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Environment Status</CardTitle>
            <CardDescription>
              Check your configuration status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Dashboard Password</p>
                <p className="text-sm text-gray-500">Set via DASHBOARD_PASSWORD env variable</p>
              </div>
              <Badge variant="secondary">Configured</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Anthropic API Key</p>
                <p className="text-sm text-gray-500">Set via ANTHROPIC_API_KEY env variable</p>
              </div>
              <Badge variant="outline">Required for summaries</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Database</p>
                <p className="text-sm text-gray-500">SQLite local database</p>
              </div>
              <Badge variant="secondary">Connected</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How to Configure</CardTitle>
            <CardDescription>
              Update your .env file with these values
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg text-sm overflow-x-auto">
{`# Dashboard password
DASHBOARD_PASSWORD=your-secure-password

# Anthropic API Key (get from console.anthropic.com)
ANTHROPIC_API_KEY=sk-ant-...

# Database (default SQLite)
DATABASE_URL=file:./dev.db`}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p>Telegram Summarizer v1.0.0</p>
            <p>Built with Next.js, Prisma, and Claude AI</p>
            <p>Summarize your Telegram group conversations with AI-powered insights</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
