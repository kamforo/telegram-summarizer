'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/dashboard/layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Sparkles, Loader2, Check, Copy, Clock, MessageSquare } from 'lucide-react'

interface Group {
  id: string
  name: string
  summarizationGoal: string
  _count: {
    messages: number
    summaries: number
  }
}

interface LastSummaryInfo {
  lastSummaryDate: string | null
  messagesSinceLastSummary: number
  totalMessages: number
}

interface SummaryResult {
  id: string
  content: string
  bulletPoints: string[]
  messageCount: number
  startDate: string
  endDate: string
}

export default function SummarizePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const [group, setGroup] = useState<Group | null>(null)
  const [lastSummaryInfo, setLastSummaryInfo] = useState<LastSummaryInfo | null>(null)
  const [period, setPeriod] = useState('since_last')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<SummaryResult | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [groupRes, infoRes] = await Promise.all([
          fetch(`/api/groups/${resolvedParams.id}`),
          fetch(`/api/groups/${resolvedParams.id}/summary-info`),
        ])

        if (groupRes.ok) {
          const data = await groupRes.json()
          setGroup(data)
        }

        if (infoRes.ok) {
          const info = await infoRes.json()
          setLastSummaryInfo(info)
          // Default to 'all' if no previous summaries
          if (!info.lastSummaryDate) {
            setPeriod('all')
          }
        }
      } catch (err) {
        console.error('Failed to fetch data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [resolvedParams.id])

  const handleGenerate = async () => {
    setGenerating(true)
    setError('')
    setResult(null)

    try {
      const response = await fetch('/api/summaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: resolvedParams.id,
          period,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate summary')
      }

      setResult(data)

      // Refresh the summary info
      const infoRes = await fetch(`/api/groups/${resolvedParams.id}/summary-info`)
      if (infoRes.ok) {
        setLastSummaryInfo(await infoRes.json())
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate summary')
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = async () => {
    if (!result) return

    const text = `# Summary\n\n${result.content}\n\n## Key Points\n\n${result.bulletPoints.map(p => `- ${p}`).join('\n')}`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getPeriodDescription = () => {
    if (!lastSummaryInfo) return ''

    switch (period) {
      case 'since_last':
        if (lastSummaryInfo.lastSummaryDate) {
          return `${lastSummaryInfo.messagesSinceLastSummary.toLocaleString()} new messages since ${new Date(lastSummaryInfo.lastSummaryDate).toLocaleDateString()}`
        }
        return `${lastSummaryInfo.totalMessages.toLocaleString()} messages (no previous summary)`
      case 'all':
        return `${lastSummaryInfo.totalMessages.toLocaleString()} total messages`
      case 'daily':
        return 'Messages from yesterday'
      case 'weekly':
        return 'Messages from last week'
      case 'monthly':
        return 'Messages from last month'
      default:
        return ''
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">Loading...</div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href={`/groups/${resolvedParams.id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Generate Summary</h1>
            <p className="text-gray-500">{group?.name}</p>
          </div>
        </div>

        {/* Status Cards */}
        {lastSummaryInfo && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Last Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {lastSummaryInfo.lastSummaryDate
                    ? new Date(lastSummaryInfo.lastSummaryDate).toLocaleDateString()
                    : 'Never'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  New Messages
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {lastSummaryInfo.messagesSinceLastSummary.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">
                  {lastSummaryInfo.totalMessages.toLocaleString()} total
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Summary Settings</CardTitle>
            <CardDescription>
              Choose which messages to summarize
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Time Period</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="since_last">
                    Since Last Summary (Recommended)
                  </SelectItem>
                  <SelectItem value="daily">Last 24 Hours</SelectItem>
                  <SelectItem value="weekly">Last Week</SelectItem>
                  <SelectItem value="monthly">Last Month</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>
              {getPeriodDescription() && (
                <p className="text-sm text-gray-500">{getPeriodDescription()}</p>
              )}
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Summarization Goal:</span>{' '}
                {group?.summarizationGoal}
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <Button
              onClick={handleGenerate}
              disabled={generating || (period === 'since_last' && lastSummaryInfo?.messagesSinceLastSummary === 0)}
              className="w-full"
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Summary...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Summary
                </>
              )}
            </Button>

            {period === 'since_last' && lastSummaryInfo?.messagesSinceLastSummary === 0 && (
              <p className="text-sm text-gray-500 text-center">
                No new messages since last summary. Upload new messages first.
              </p>
            )}
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Summary Result</CardTitle>
                  <CardDescription>
                    Based on {result.messageCount.toLocaleString()} messages from{' '}
                    {new Date(result.startDate).toLocaleDateString()} to{' '}
                    {new Date(result.endDate).toLocaleDateString()}
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-medium mb-2">Executive Summary</h3>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {result.content}
                </p>
              </div>

              <div>
                <h3 className="font-medium mb-2">Key Points</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
                  {result.bulletPoints.map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              </div>

              <div className="pt-4 border-t">
                <Link href={`/groups/${resolvedParams.id}`}>
                  <Button variant="outline">
                    View All Summaries
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
