import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateSummary } from '@/lib/claude'
import { extractTopics } from '@/lib/topic-extraction'
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths } from 'date-fns'

// GET /api/summaries - List summaries for a group
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const groupId = searchParams.get('groupId')
  const period = searchParams.get('period')

  if (!groupId) {
    return NextResponse.json(
      { error: 'groupId is required' },
      { status: 400 }
    )
  }

  try {
    const where: { groupId: string; period?: string } = { groupId }
    if (period) {
      where.period = period
    }

    const summaries = await prisma.summary.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(summaries)
  } catch (error) {
    console.error('Error fetching summaries:', error)
    return NextResponse.json(
      { error: 'Failed to fetch summaries' },
      { status: 500 }
    )
  }
}

// POST /api/summaries - Generate a new summary
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { groupId, period, customStartDate, customEndDate } = body

    if (!groupId || !period) {
      return NextResponse.json(
        { error: 'groupId and period are required' },
        { status: 400 }
      )
    }

    if (!['daily', 'weekly', 'monthly', 'all', 'since_last', 'custom'].includes(period)) {
      return NextResponse.json(
        { error: 'Invalid period' },
        { status: 400 }
      )
    }

    // Get the group
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    })

    if (!group) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      )
    }

    // Calculate date range based on period
    const now = new Date()
    let startDate: Date
    let endDate: Date = now
    let periodLabel = period

    switch (period) {
      case 'daily':
        startDate = startOfDay(subDays(now, 1))
        endDate = endOfDay(subDays(now, 1))
        break
      case 'weekly':
        startDate = startOfWeek(subWeeks(now, 1))
        endDate = endOfWeek(subWeeks(now, 1))
        break
      case 'monthly':
        startDate = startOfMonth(subMonths(now, 1))
        endDate = endOfMonth(subMonths(now, 1))
        break
      case 'since_last':
        // Find the last summary for this group
        const lastSummary = await prisma.summary.findFirst({
          where: { groupId },
          orderBy: { endDate: 'desc' },
        })
        if (lastSummary) {
          startDate = new Date(lastSummary.endDate)
        } else {
          // No previous summary, get earliest message
          const earliest = await prisma.message.findFirst({
            where: { groupId },
            orderBy: { timestamp: 'asc' },
          })
          startDate = earliest?.timestamp || new Date(0)
        }
        endDate = now
        periodLabel = 'incremental'
        break
      case 'custom':
        if (!customStartDate || !customEndDate) {
          return NextResponse.json(
            { error: 'customStartDate and customEndDate required for custom period' },
            { status: 400 }
          )
        }
        startDate = new Date(customStartDate)
        endDate = new Date(customEndDate)
        break
      case 'all':
      default:
        // Get earliest message date
        const earliestMsg = await prisma.message.findFirst({
          where: { groupId },
          orderBy: { timestamp: 'asc' },
        })
        startDate = earliestMsg?.timestamp || new Date(0)
        endDate = now
        break
    }

    // Fetch messages for the date range
    const messages = await prisma.message.findMany({
      where: {
        groupId,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { timestamp: 'asc' },
    })

    if (messages.length === 0) {
      return NextResponse.json(
        { error: 'No messages found in the specified date range' },
        { status: 400 }
      )
    }

    // Generate summary using Claude
    const result = await generateSummary(
      messages.map(m => ({
        content: m.content,
        senderName: m.senderName,
        timestamp: m.timestamp,
      })),
      group.summarizationGoal
    )

    // Save the summary
    const summary = await prisma.summary.create({
      data: {
        groupId,
        period: periodLabel,
        startDate,
        endDate,
        content: result.summary,
        bulletPoints: JSON.stringify(result.bulletPoints),
        messageCount: messages.length,
      },
    })

    // Extract and save topics (async, don't block response)
    extractTopics(result.summary, result.bulletPoints)
      .then(async (topics) => {
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
      })
      .catch((error) => {
        console.error('Error extracting topics:', error)
      })

    return NextResponse.json({
      ...summary,
      bulletPoints: result.bulletPoints,
    })
  } catch (error) {
    console.error('Error generating summary:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate summary' },
      { status: 500 }
    )
  }
}
