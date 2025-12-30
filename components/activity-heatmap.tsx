'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'

interface HeatmapCell {
  day: number
  hour: number
  count: number
}

interface ActivityData {
  heatmap: HeatmapCell[]
  maxCount: number
  totalMessages: number
  dateRange: {
    start: string
    end: string
  }
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 24 }, (_, i) => {
  if (i === 0) return '12am'
  if (i === 12) return '12pm'
  return i < 12 ? `${i}am` : `${i - 12}pm`
})

function getIntensityClass(count: number, maxCount: number): string {
  if (count === 0) return 'bg-gray-100 dark:bg-gray-800'
  const intensity = count / maxCount
  if (intensity < 0.25) return 'bg-blue-200 dark:bg-blue-900'
  if (intensity < 0.5) return 'bg-blue-400 dark:bg-blue-700'
  if (intensity < 0.75) return 'bg-blue-500 dark:bg-blue-600'
  return 'bg-blue-600 dark:bg-blue-500'
}

interface ActivityHeatmapProps {
  groupId: string
}

export function ActivityHeatmap({ groupId }: ActivityHeatmapProps) {
  const [data, setData] = useState<ActivityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState('30')
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/groups/${groupId}/activity?days=${days}`)
        if (response.ok) {
          const result = await response.json()
          setData(result)
        }
      } catch (error) {
        console.error('Failed to fetch activity data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [groupId, days])

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-gray-500">
          Failed to load activity data
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Activity Heatmap</CardTitle>
            <CardDescription>
              Message activity by day and hour ({data.totalMessages.toLocaleString()} messages)
            </CardDescription>
          </div>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          {/* Hour labels */}
          <div className="flex mb-1 ml-10">
            {HOURS.filter((_, i) => i % 3 === 0).map((hour, i) => (
              <div
                key={hour}
                className="text-xs text-gray-500"
                style={{ width: '36px', marginLeft: i === 0 ? 0 : '36px' }}
              >
                {hour}
              </div>
            ))}
          </div>

          {/* Heatmap grid */}
          <div className="space-y-1">
            {DAYS.map((day, dayIndex) => (
              <div key={day} className="flex items-center gap-1">
                <div className="w-8 text-xs text-gray-500 text-right pr-2">{day}</div>
                <div className="flex gap-px">
                  {Array.from({ length: 24 }, (_, hourIndex) => {
                    const cell = data.heatmap.find(
                      (c) => c.day === dayIndex && c.hour === hourIndex
                    )
                    const count = cell?.count || 0

                    return (
                      <div
                        key={hourIndex}
                        className={`w-3 h-3 rounded-sm cursor-pointer transition-all hover:ring-2 hover:ring-blue-400 ${getIntensityClass(count, data.maxCount)}`}
                        onMouseEnter={() => setHoveredCell({ day: dayIndex, hour: hourIndex, count })}
                        onMouseLeave={() => setHoveredCell(null)}
                        title={`${DAYS[dayIndex]} ${HOURS[hourIndex]}: ${count} messages`}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Tooltip */}
          {hoveredCell && (
            <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">{DAYS[hoveredCell.day]} {HOURS[hoveredCell.hour]}</span>
              : {hoveredCell.count} message{hoveredCell.count !== 1 ? 's' : ''}
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-2 mt-4 text-xs text-gray-500">
            <span>Less</span>
            <div className="flex gap-px">
              <div className="w-3 h-3 rounded-sm bg-gray-100 dark:bg-gray-800" />
              <div className="w-3 h-3 rounded-sm bg-blue-200 dark:bg-blue-900" />
              <div className="w-3 h-3 rounded-sm bg-blue-400 dark:bg-blue-700" />
              <div className="w-3 h-3 rounded-sm bg-blue-500 dark:bg-blue-600" />
              <div className="w-3 h-3 rounded-sm bg-blue-600 dark:bg-blue-500" />
            </div>
            <span>More</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
