import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { extractTopics } from '@/lib/topic-extraction'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params

    // Verify group exists
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    })

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Get all topics with their mentions and associated summaries
    const topics = await prisma.topic.findMany({
      where: { groupId },
      include: {
        mentions: {
          include: {
            summary: {
              select: {
                id: true,
                period: true,
                startDate: true,
                endDate: true,
                createdAt: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Transform data for charting
    // Group mentions by date for trend visualization
    const trendData: Record<string, Record<string, number>> = {}

    for (const topic of topics) {
      for (const mention of topic.mentions) {
        const dateKey = mention.summary.endDate.toISOString().split('T')[0]
        if (!trendData[dateKey]) {
          trendData[dateKey] = {}
        }
        trendData[dateKey][topic.name] = (trendData[dateKey][topic.name] || 0) + mention.frequency
      }
    }

    // Convert to array format for recharts
    const chartData = Object.entries(trendData)
      .map(([date, topics]) => ({
        date,
        ...topics,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Calculate total frequency per topic
    const topicStats = topics.map((topic) => ({
      id: topic.id,
      name: topic.name,
      totalMentions: topic.mentions.length,
      totalFrequency: topic.mentions.reduce((sum, m) => sum + m.frequency, 0),
      firstSeen: topic.mentions[0]?.summary.endDate || topic.createdAt,
      lastSeen: topic.mentions[topic.mentions.length - 1]?.summary.endDate || topic.createdAt,
    }))

    // Sort by total frequency
    topicStats.sort((a, b) => b.totalFrequency - a.totalFrequency)

    return NextResponse.json({
      topics: topicStats,
      chartData,
      topicNames: topics.map((t) => t.name),
    })
  } catch (error) {
    console.error('Error fetching topics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch topics' },
      { status: 500 }
    )
  }
}

// POST - Extract topics from existing summaries
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params

    // Get all summaries that don't have topic mentions yet
    const summaries = await prisma.summary.findMany({
      where: {
        groupId,
        topicMentions: {
          none: {},
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    if (summaries.length === 0) {
      return NextResponse.json({
        message: 'All summaries already have topics extracted',
        processed: 0,
      })
    }

    let processed = 0
    const errors: string[] = []

    for (const summary of summaries) {
      try {
        const bulletPoints = JSON.parse(summary.bulletPoints)
        const topics = await extractTopics(summary.content, bulletPoints)

        for (const topic of topics) {
          // Upsert topic
          const existingTopic = await prisma.topic.upsert({
            where: {
              groupId_name: {
                groupId,
                name: topic.name,
              },
            },
            create: {
              groupId,
              name: topic.name,
            },
            update: {},
          })

          // Create mention
          await prisma.topicMention.create({
            data: {
              topicId: existingTopic.id,
              summaryId: summary.id,
              frequency: topic.frequency,
            },
          })
        }

        processed++
      } catch (err) {
        errors.push(`Summary ${summary.id}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }

    return NextResponse.json({
      message: `Extracted topics from ${processed} summaries`,
      processed,
      total: summaries.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Error extracting topics:', error)
    return NextResponse.json(
      { error: 'Failed to extract topics' },
      { status: 500 }
    )
  }
}
