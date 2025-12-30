'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Sparkles, Copy, Check, Trash2, MessageCircle, FileText } from 'lucide-react'

interface PostSuggestion {
  id: string
  type: string
  title: string
  content: string
  reasoning: string | null
  used: boolean
  createdAt: string
}

interface PostSuggestionsProps {
  groupId: string
}

export function PostSuggestions({ groupId }: PostSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<PostSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fetchSuggestions = async () => {
    try {
      const response = await fetch(`/api/groups/${groupId}/post-suggestions`)
      if (response.ok) {
        const data = await response.json()
        setSuggestions(data)
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSuggestions()
  }, [groupId])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const response = await fetch(`/api/groups/${groupId}/post-suggestions`, {
        method: 'POST',
      })
      if (response.ok) {
        await fetchSuggestions()
      }
    } catch (error) {
      console.error('Failed to generate suggestions:', error)
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = async (suggestion: PostSuggestion) => {
    await navigator.clipboard.writeText(suggestion.content)
    setCopiedId(suggestion.id)
    setTimeout(() => setCopiedId(null), 2000)

    // Mark as used
    await fetch(`/api/groups/${groupId}/post-suggestions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suggestionId: suggestion.id, used: true }),
    })

    setSuggestions((prev) =>
      prev.map((s) => (s.id === suggestion.id ? { ...s, used: true } : s))
    )
  }

  const handleDelete = async (suggestionId: string) => {
    await fetch(`/api/groups/${groupId}/post-suggestions?suggestionId=${suggestionId}`, {
      method: 'DELETE',
    })
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId))
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

  const unusedSuggestions = suggestions.filter((s) => !s.used)
  const usedSuggestions = suggestions.filter((s) => s.used)

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Post Ideas</CardTitle>
              <CardDescription>
                AI-generated suggestions for engaging posts based on recent discussions
              </CardDescription>
            </div>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Ideas
                </>
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Suggestions */}
      {suggestions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Sparkles className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500">No post suggestions yet</p>
            <p className="text-sm text-gray-400 mt-1 mb-4">
              Generate ideas based on your group's recent discussions
            </p>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Ideas
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Unused Suggestions */}
          {unusedSuggestions.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                New Ideas ({unusedSuggestions.length})
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {unusedSuggestions.map((suggestion) => (
                  <Card key={suggestion.id} className="relative">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {suggestion.type === 'question' ? (
                            <MessageCircle className="h-4 w-4 text-blue-500" />
                          ) : (
                            <FileText className="h-4 w-4 text-green-500" />
                          )}
                          <CardTitle className="text-base">{suggestion.title}</CardTitle>
                        </div>
                        <Badge variant={suggestion.type === 'question' ? 'default' : 'secondary'}>
                          {suggestion.type}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm">{suggestion.content}</p>
                      {suggestion.reasoning && (
                        <p className="text-xs text-gray-500 italic">
                          {suggestion.reasoning}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCopy(suggestion)}
                        >
                          {copiedId === suggestion.id ? (
                            <>
                              <Check className="mr-1 h-3 w-3" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="mr-1 h-3 w-3" />
                              Copy
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(suggestion.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Used Suggestions */}
          {usedSuggestions.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Used ({usedSuggestions.length})
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {usedSuggestions.map((suggestion) => (
                  <Card key={suggestion.id} className="opacity-60">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {suggestion.type === 'question' ? (
                            <MessageCircle className="h-4 w-4 text-blue-500" />
                          ) : (
                            <FileText className="h-4 w-4 text-green-500" />
                          )}
                          <CardTitle className="text-base">{suggestion.title}</CardTitle>
                        </div>
                        <Badge variant="outline">used</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm">{suggestion.content}</p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(suggestion.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
