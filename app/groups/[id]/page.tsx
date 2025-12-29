'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { DashboardLayout } from '@/components/dashboard/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, Upload, FileText, MessageSquare, Sparkles, Save, Send, Loader2, ChevronDown, ChevronUp } from 'lucide-react'

interface Group {
  id: string
  name: string
  description: string | null
  summarizationGoal: string
  createdAt: string
  _count: {
    messages: number
    summaries: number
  }
}

interface Summary {
  id: string
  period: string
  startDate: string
  endDate: string
  content: string
  bulletPoints: string
  messageCount: number
  createdAt: string
}

interface QAMessage {
  role: 'user' | 'assistant'
  content: string
}

export default function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [group, setGroup] = useState<Group | null>(null)
  const [summaries, setSummaries] = useState<Summary[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expandedSummary, setExpandedSummary] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    summarizationGoal: '',
  })

  // Q&A state
  const [selectedSummaryForQA, setSelectedSummaryForQA] = useState<string | null>(null)
  const [question, setQuestion] = useState('')
  const [qaMessages, setQaMessages] = useState<Record<string, QAMessage[]>>({})
  const [askingQuestion, setAskingQuestion] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [groupRes, summariesRes] = await Promise.all([
          fetch(`/api/groups/${resolvedParams.id}`),
          fetch(`/api/summaries?groupId=${resolvedParams.id}`),
        ])

        if (!groupRes.ok) {
          router.push('/groups')
          return
        }

        const groupData = await groupRes.json()
        setGroup(groupData)
        setEditForm({
          name: groupData.name,
          description: groupData.description || '',
          summarizationGoal: groupData.summarizationGoal,
        })

        if (summariesRes.ok) {
          const summariesData = await summariesRes.json()
          setSummaries(summariesData)
          // Expand the first summary by default
          if (summariesData.length > 0) {
            setExpandedSummary(summariesData[0].id)
          }
        }
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [resolvedParams.id, router])

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch(`/api/groups/${resolvedParams.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })

      if (response.ok) {
        const updated = await response.json()
        setGroup({ ...group!, ...updated })
      }
    } catch (error) {
      console.error('Failed to save:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleAskQuestion = async (summaryId: string) => {
    if (!question.trim()) return

    setAskingQuestion(true)
    const currentQuestion = question
    setQuestion('')

    // Add user message
    setQaMessages(prev => ({
      ...prev,
      [summaryId]: [...(prev[summaryId] || []), { role: 'user', content: currentQuestion }]
    }))

    try {
      const response = await fetch(`/api/groups/${resolvedParams.id}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: currentQuestion,
          summaryId,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setQaMessages(prev => ({
          ...prev,
          [summaryId]: [...(prev[summaryId] || []), { role: 'assistant', content: data.answer }]
        }))
      } else {
        setQaMessages(prev => ({
          ...prev,
          [summaryId]: [...(prev[summaryId] || []), { role: 'assistant', content: `Error: ${data.error}` }]
        }))
      }
    } catch (error) {
      setQaMessages(prev => ({
        ...prev,
        [summaryId]: [...(prev[summaryId] || []), { role: 'assistant', content: 'Failed to get answer. Please try again.' }]
      }))
    } finally {
      setAskingQuestion(false)
    }
  }

  const toggleSummary = (id: string) => {
    setExpandedSummary(expandedSummary === id ? null : id)
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">Loading...</div>
      </DashboardLayout>
    )
  }

  if (!group) {
    return null
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/groups">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{group.name}</h1>
            <div className="flex gap-2 mt-2">
              <Badge variant="secondary" className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {group._count.messages} messages
              </Badge>
              <Badge variant="secondary" className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {group._count.summaries} summaries
              </Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={`/groups/${group.id}/upload`}>
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Upload Messages
              </Button>
            </Link>
            <Link href={`/groups/${group.id}/summarize`}>
              <Button>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Summary
              </Button>
            </Link>
          </div>
        </div>

        <Tabs defaultValue="summaries">
          <TabsList>
            <TabsTrigger value="summaries">Summaries ({group._count.summaries})</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="summaries" className="mt-6">
            {summaries.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-gray-500 mb-4">No summaries yet</p>
                  <Link href={`/groups/${group.id}/summarize`}>
                    <Button>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate First Summary
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {summaries.map((summary) => {
                  const isExpanded = expandedSummary === summary.id
                  const bulletPoints = JSON.parse(summary.bulletPoints)
                  const messages = qaMessages[summary.id] || []

                  return (
                    <Card key={summary.id}>
                      <CardHeader
                        className="cursor-pointer"
                        onClick={() => toggleSummary(summary.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg capitalize flex items-center gap-2">
                              {summary.period} Summary
                              <Badge variant="outline" className="text-xs font-normal">
                                {summary.messageCount} messages
                              </Badge>
                            </CardTitle>
                            <CardDescription>
                              {new Date(summary.startDate).toLocaleDateString()} - {new Date(summary.endDate).toLocaleDateString()}
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge>{summary.period}</Badge>
                            {isExpanded ? (
                              <ChevronUp className="h-5 w-5 text-gray-400" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-gray-400" />
                            )}
                          </div>
                        </div>
                      </CardHeader>

                      {isExpanded && (
                        <CardContent className="space-y-6">
                          {/* Summary Content with Markdown */}
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                              Executive Summary
                            </h4>
                            <ReactMarkdown>{summary.content}</ReactMarkdown>
                          </div>

                          {/* Bullet Points */}
                          <div>
                            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                              Key Points
                            </h4>
                            <ul className="space-y-2">
                              {bulletPoints.map((point: string, i: number) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-primary mt-1">•</span>
                                  <span className="prose prose-sm dark:prose-invert">
                                    <ReactMarkdown
                                      components={{
                                        p: ({ children }) => <span>{children}</span>
                                      }}
                                    >
                                      {point}
                                    </ReactMarkdown>
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Q&A Section */}
                          <div className="border-t pt-4">
                            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                              Ask a Question
                            </h4>
                            <p className="text-xs text-gray-500 mb-3">
                              Ask follow-up questions about this summary. Answers are based only on the actual messages.
                            </p>

                            {/* Q&A Messages */}
                            {messages.length > 0 && (
                              <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                                {messages.map((msg, i) => (
                                  <div
                                    key={i}
                                    className={`p-3 rounded-lg ${
                                      msg.role === 'user'
                                        ? 'bg-primary/10 ml-8'
                                        : 'bg-gray-100 dark:bg-gray-800 mr-8'
                                    }`}
                                  >
                                    <p className="text-xs font-medium text-gray-500 mb-1">
                                      {msg.role === 'user' ? 'You' : 'Assistant'}
                                    </p>
                                    <div className="prose prose-sm dark:prose-invert max-w-none">
                                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Question Input */}
                            <div className="flex gap-2">
                              <Input
                                placeholder="e.g., What was said about...?"
                                value={selectedSummaryForQA === summary.id ? question : ''}
                                onChange={(e) => {
                                  setSelectedSummaryForQA(summary.id)
                                  setQuestion(e.target.value)
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault()
                                    handleAskQuestion(summary.id)
                                  }
                                }}
                                disabled={askingQuestion}
                              />
                              <Button
                                size="icon"
                                onClick={() => handleAskQuestion(summary.id)}
                                disabled={askingQuestion || !question.trim()}
                              >
                                {askingQuestion && selectedSummaryForQA === summary.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Send className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Group Settings</CardTitle>
                <CardDescription>
                  Update the group details and summarization preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Group Name</Label>
                  <Input
                    id="name"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="summarizationGoal">Summarization Goal</Label>
                  <Textarea
                    id="summarizationGoal"
                    value={editForm.summarizationGoal}
                    onChange={(e) => setEditForm({ ...editForm, summarizationGoal: e.target.value })}
                    rows={3}
                  />
                  <p className="text-sm text-gray-500">
                    Define what the AI should focus on when creating summaries
                  </p>
                </div>

                <Button onClick={handleSave} disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
