'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Loader2, MessageSquare, ChevronDown, ChevronRight, Trash2, Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface ThreadMessage {
  id: string
  messageId: string
  position: number
}

interface Thread {
  id: string
  title: string
  summary: string | null
  startTime: string
  endTime: string
  messages: ThreadMessage[]
}

interface ThreadViewProps {
  groupId: string
}

export function ThreadView({ groupId }: ThreadViewProps) {
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)
  const [detecting, setDetecting] = useState(false)
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set())

  const fetchThreads = async () => {
    try {
      const response = await fetch(`/api/groups/${groupId}/threads`)
      if (response.ok) {
        const data = await response.json()
        setThreads(data)
      }
    } catch (error) {
      console.error('Failed to fetch threads:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchThreads()
  }, [groupId])

  const handleDetect = async () => {
    setDetecting(true)
    try {
      const response = await fetch(`/api/groups/${groupId}/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (response.ok) {
        await fetchThreads()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to detect threads')
      }
    } catch (error) {
      console.error('Failed to detect threads:', error)
    } finally {
      setDetecting(false)
    }
  }

  const handleDelete = async (threadId: string) => {
    try {
      await fetch(`/api/groups/${groupId}/threads?threadId=${threadId}`, {
        method: 'DELETE',
      })
      setThreads((prev) => prev.filter((t) => t.id !== threadId))
    } catch (error) {
      console.error('Failed to delete thread:', error)
    }
  }

  const toggleExpand = (threadId: string) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev)
      if (next.has(threadId)) {
        next.delete(threadId)
      } else {
        next.add(threadId)
      }
      return next
    })
  }

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    const sameDay = startDate.toDateString() === endDate.toDateString()

    if (sameDay) {
      return `${startDate.toLocaleDateString()} ${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    }
    return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Conversation Threads</CardTitle>
              <CardDescription>
                AI-detected topic clusters from your group messages
              </CardDescription>
            </div>
            <Button onClick={handleDetect} disabled={detecting}>
              {detecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Detecting...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Detect Threads
                </>
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Threads List */}
      {threads.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500">No conversation threads detected</p>
            <p className="text-sm text-gray-400 mt-1 mb-4">
              Click "Detect Threads" to analyze your messages for topic clusters
            </p>
            <Button onClick={handleDetect} disabled={detecting}>
              {detecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Detecting...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Detect Threads
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {threads.map((thread) => (
            <Card key={thread.id}>
              <Collapsible
                open={expandedThreads.has(thread.id)}
                onOpenChange={() => toggleExpand(thread.id)}
              >
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {expandedThreads.has(thread.id) ? (
                          <ChevronDown className="h-5 w-5 mt-0.5 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-5 w-5 mt-0.5 text-gray-500" />
                        )}
                        <div>
                          <CardTitle className="text-base">{thread.title}</CardTitle>
                          <CardDescription className="mt-1">
                            {formatDateRange(thread.startTime, thread.endTime)}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {thread.messages.length} messages
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(thread.id)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    {thread.summary && (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>{thread.summary}</ReactMarkdown>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
