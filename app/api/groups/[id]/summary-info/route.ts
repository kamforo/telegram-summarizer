import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params

    // Get the last summary
    const lastSummary = await prisma.summary.findFirst({
      where: { groupId },
      orderBy: { endDate: 'desc' },
    })

    // Get total message count
    const totalMessages = await prisma.message.count({
      where: { groupId },
    })

    // Get messages since last summary
    let messagesSinceLastSummary = totalMessages
    if (lastSummary) {
      messagesSinceLastSummary = await prisma.message.count({
        where: {
          groupId,
          timestamp: {
            gt: lastSummary.endDate,
          },
        },
      })
    }

    return NextResponse.json({
      lastSummaryDate: lastSummary?.endDate || null,
      lastSummaryId: lastSummary?.id || null,
      messagesSinceLastSummary,
      totalMessages,
    })
  } catch (error) {
    console.error('Error fetching summary info:', error)
    return NextResponse.json(
      { error: 'Failed to fetch summary info' },
      { status: 500 }
    )
  }
}
