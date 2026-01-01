import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { detectThreads, summarizeThread } from '@/lib/thread-detection'

// GET - List threads for a group
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params

    const threads = await prisma.thread.findMany({
      where: { groupId },
      orderBy: { startTime: 'desc' },
      include: {
        messages: {
          orderBy: { position: 'asc' },
        },
      },
    })

    return NextResponse.json(threads)
  } catch (error) {
    console.error('Error fetching threads:', error)
    return NextResponse.json(
      { error: 'Failed to fetch threads' },
      { status: 500 }
    )
  }
}

// POST - Detect threads from messages
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params
    const body = await request.json().catch(() => ({}))
    const { startDate, endDate } = body

    // Build date filter
    const dateFilter: { gte?: Date; lte?: Date } = {}
    if (startDate) dateFilter.gte = new Date(startDate)
    if (endDate) dateFilter.lte = new Date(endDate)

    // Get messages
    const messages = await prisma.message.findMany({
      where: {
        groupId,
        ...(Object.keys(dateFilter).length > 0 && { timestamp: dateFilter }),
      },
      orderBy: { timestamp: 'asc' },
      take: 500, // Limit for performance
    })

    if (messages.length < 5) {
      return NextResponse.json(
        { error: 'Not enough messages to detect threads (minimum 5)' },
        { status: 400 }
      )
    }

    // Detect threads
    const detectedThreads = await detectThreads(
      messages.map((m) => ({
        id: m.id,
        content: m.content,
        senderName: m.senderName,
        timestamp: m.timestamp,
      }))
    )

    if (detectedThreads.length === 0) {
      return NextResponse.json(
        { error: 'No significant conversation threads detected' },
        { status: 400 }
      )
    }

    // Save threads to database
    const createdThreads = []
    for (const thread of detectedThreads) {
      // Get the actual messages for this thread to generate summary
      const threadMessages = messages.filter((m) =>
        thread.messageIds.includes(m.id)
      )

      // Generate summary for the thread
      const summary = await summarizeThread(
        threadMessages.map((m) => ({
          id: m.id,
          content: m.content,
          senderName: m.senderName,
          timestamp: m.timestamp,
        })),
        thread.title
      )

      const created = await prisma.thread.create({
        data: {
          groupId,
          title: thread.title,
          summary,
          startTime: thread.startTime,
          endTime: thread.endTime,
          messages: {
            create: thread.messageIds.map((messageId, index) => ({
              messageId,
              position: index,
            })),
          },
        },
        include: {
          messages: true,
        },
      })

      createdThreads.push(created)
    }

    return NextResponse.json({
      message: `Detected ${createdThreads.length} threads`,
      threads: createdThreads,
    })
  } catch (error) {
    console.error('Error detecting threads:', error)
    return NextResponse.json(
      { error: 'Failed to detect threads' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a thread
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const threadId = searchParams.get('threadId')

    if (!threadId) {
      return NextResponse.json(
        { error: 'threadId is required' },
        { status: 400 }
      )
    }

    await prisma.thread.delete({
      where: { id: threadId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting thread:', error)
    return NextResponse.json(
      { error: 'Failed to delete thread' },
      { status: 500 }
    )
  }
}
