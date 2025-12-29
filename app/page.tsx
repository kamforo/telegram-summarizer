'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/dashboard/layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Users, MessageSquare, FileText, ArrowRight } from 'lucide-react'

interface Group {
  id: string
  name: string
  description: string | null
  _count: {
    messages: number
    summaries: number
  }
}

interface Summary {
  id: string
  groupId: string
  period: string
  content: string
  bulletPoints: string
  messageCount: number
  createdAt: string
  group: {
    name: string
  }
}

interface Stats {
  totalGroups: number
  totalMessages: number
  totalSummaries: number
}

export default function DashboardPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [recentSummaries, setRecentSummaries] = useState<Summary[]>([])
  const [stats, setStats] = useState<Stats>({ totalGroups: 0, totalMessages: 0, totalSummaries: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [groupsRes, statsRes] = await Promise.all([
          fetch('/api/groups'),
          fetch('/api/stats'),
        ])

        if (groupsRes.ok) {
          const groupsData = await groupsRes.json()
          setGroups(groupsData)

          // Calculate stats from groups
          const totalMessages = groupsData.reduce((sum: number, g: Group) => sum + g._count.messages, 0)
          const totalSummaries = groupsData.reduce((sum: number, g: Group) => sum + g._count.summaries, 0)
          setStats({
            totalGroups: groupsData.length,
            totalMessages,
            totalSummaries,
          })
        }

        if (statsRes.ok) {
          const summariesData = await statsRes.json()
          setRecentSummaries(summariesData.recentSummaries || [])
        }
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">Loading...</div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-gray-500">Overview of your Telegram groups and summaries</p>
          </div>
          <Link href="/groups/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Group
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Groups</CardTitle>
              <Users className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalGroups}</div>
              <p className="text-xs text-gray-500">Telegram groups tracked</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
              <MessageSquare className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalMessages.toLocaleString()}</div>
              <p className="text-xs text-gray-500">Messages imported</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Summaries Generated</CardTitle>
              <FileText className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSummaries}</div>
              <p className="text-xs text-gray-500">AI summaries created</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        {groups.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium mb-2">No groups yet</h3>
              <p className="text-gray-500 mb-4 text-center">
                Add your first Telegram group to start summarizing conversations
              </p>
              <Link href="/groups/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Group
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Groups List */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Your Groups</CardTitle>
                  <Link href="/groups">
                    <Button variant="ghost" size="sm">
                      View All
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {groups.slice(0, 5).map((group) => (
                    <Link
                      key={group.id}
                      href={`/groups/${group.id}`}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div>
                        <p className="font-medium">{group.name}</p>
                        <p className="text-sm text-gray-500">
                          {group._count.messages} messages • {group._count.summaries} summaries
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-400" />
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Summaries */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Summaries</CardTitle>
                <CardDescription>Latest AI-generated summaries</CardDescription>
              </CardHeader>
              <CardContent>
                {recentSummaries.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No summaries yet</p>
                    <p className="text-sm">Upload messages and generate your first summary</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentSummaries.slice(0, 5).map((summary) => (
                      <div
                        key={summary.id}
                        className="p-3 rounded-lg border bg-gray-50 dark:bg-gray-800"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{summary.group.name}</span>
                          <Badge variant="secondary" className="text-xs capitalize">
                            {summary.period}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                          {summary.content}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
                          {new Date(summary.createdAt).toLocaleDateString()} • {summary.messageCount} messages
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
