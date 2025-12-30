'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, TrendingUp } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

interface TopicStat {
  id: string
  name: string
  totalMentions: number
  totalFrequency: number
  firstSeen: string
  lastSeen: string
}

interface TopicsData {
  topics: TopicStat[]
  chartData: Array<Record<string, string | number>>
  topicNames: string[]
}

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
]

interface TopicTrendsChartProps {
  groupId: string
}

export function TopicTrendsChart({ groupId }: TopicTrendsChartProps) {
  const [data, setData] = useState<TopicsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set())

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/groups/${groupId}/topics`)
        if (response.ok) {
          const result = await response.json()
          setData(result)
          // Select top 5 topics by default
          const topTopics = result.topics.slice(0, 5).map((t: TopicStat) => t.name)
          setSelectedTopics(new Set(topTopics))
        }
      } catch (error) {
        console.error('Failed to fetch topics:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [groupId])

  const toggleTopic = (topicName: string) => {
    const newSelected = new Set(selectedTopics)
    if (newSelected.has(topicName)) {
      newSelected.delete(topicName)
    } else {
      newSelected.add(topicName)
    }
    setSelectedTopics(newSelected)
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

  if (!data || data.topics.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <TrendingUp className="h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500">No topic data yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Generate summaries to start tracking topics
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Topic Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Top Topics</CardTitle>
          <CardDescription>Click to toggle topics in the chart</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {data.topics.map((topic, index) => (
              <Badge
                key={topic.id}
                variant={selectedTopics.has(topic.name) ? 'default' : 'outline'}
                className="cursor-pointer transition-all"
                style={{
                  backgroundColor: selectedTopics.has(topic.name)
                    ? COLORS[index % COLORS.length]
                    : undefined,
                  borderColor: COLORS[index % COLORS.length],
                }}
                onClick={() => toggleTopic(topic.name)}
              >
                {topic.name}
                <span className="ml-1 opacity-70">({topic.totalFrequency})</span>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Trend Chart */}
      {data.chartData.length > 0 && selectedTopics.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Topic Trends Over Time</CardTitle>
            <CardDescription>
              How topic frequency changes across summaries
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      const date = new Date(value)
                      return `${date.getMonth() + 1}/${date.getDate()}`
                    }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--background)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                    }}
                    labelFormatter={(value) => {
                      const date = new Date(value)
                      return date.toLocaleDateString()
                    }}
                  />
                  <Legend />
                  {data.topicNames
                    .filter((name) => selectedTopics.has(name))
                    .map((topicName, index) => (
                      <Line
                        key={topicName}
                        type="monotone"
                        dataKey={topicName}
                        stroke={COLORS[data.topics.findIndex((t) => t.name === topicName) % COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
