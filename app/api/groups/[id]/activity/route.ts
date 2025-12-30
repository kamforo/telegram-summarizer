import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface HeatmapCell {
  day: number // 0-6 (Sunday-Saturday)
  hour: number // 0-23
  count: number
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')

    // Verify group exists
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    })

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Fetch messages in date range
    const messages = await prisma.message.findMany({
      where: {
        groupId,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        timestamp: true,
      },
    })

    // Initialize heatmap with zeros (7 days x 24 hours)
    const heatmap: HeatmapCell[] = []
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        heatmap.push({ day, hour, count: 0 })
      }
    }

    // Count messages by day of week and hour
    for (const msg of messages) {
      const date = new Date(msg.timestamp)
      const day = date.getDay() // 0-6
      const hour = date.getHours() // 0-23
      const index = day * 24 + hour
      heatmap[index].count++
    }

    // Find max count for normalization
    const maxCount = Math.max(...heatmap.map((cell) => cell.count), 1)

    return NextResponse.json({
      heatmap,
      maxCount,
      totalMessages: messages.length,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    })
  } catch (error) {
    console.error('Error fetching activity data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activity data' },
      { status: 500 }
    )
  }
}
