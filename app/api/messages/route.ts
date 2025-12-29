import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parseExport, type ParsedMessage } from '@/lib/telegram-parser'

// GET /api/messages - Get messages for a group
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const groupId = searchParams.get('groupId')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  if (!groupId) {
    return NextResponse.json(
      { error: 'groupId is required' },
      { status: 400 }
    )
  }

  try {
    const where: {
      groupId: string
      timestamp?: {
        gte?: Date
        lte?: Date
      }
    } = { groupId }

    if (startDate || endDate) {
      where.timestamp = {}
      if (startDate) {
        where.timestamp.gte = new Date(startDate)
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate)
      }
    }

    const messages = await prisma.message.findMany({
      where,
      orderBy: { timestamp: 'asc' },
    })

    return NextResponse.json(messages)
  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}

// POST /api/messages - Upload messages from Telegram export (JSON or HTML)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { groupId, content } = body

    if (!groupId || !content) {
      return NextResponse.json(
        { error: 'groupId and content are required' },
        { status: 400 }
      )
    }

    // Check if group exists
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    })

    if (!group) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      )
    }

    // Parse the export (auto-detects JSON or HTML)
    let parsed
    try {
      parsed = parseExport(content)
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Failed to parse export' },
        { status: 400 }
      )
    }

    if (parsed.messages.length === 0) {
      return NextResponse.json(
        { error: 'No valid messages found in export' },
        { status: 400 }
      )
    }

    // Insert messages (skip duplicates by checking timestamp + content)
    let imported = 0
    let skipped = 0

    for (const msg of parsed.messages) {
      // Check for existing message with same timestamp and content
      const existing = await prisma.message.findFirst({
        where: {
          groupId,
          timestamp: msg.timestamp,
          content: msg.content,
        },
      })

      if (existing) {
        skipped++
        continue
      }

      await prisma.message.create({
        data: {
          groupId,
          content: msg.content,
          senderName: msg.senderName,
          timestamp: msg.timestamp,
        },
      })
      imported++
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      total: parsed.messages.length,
      groupName: parsed.groupName,
    })
  } catch (error) {
    console.error('Error uploading messages:', error)
    return NextResponse.json(
      { error: 'Failed to upload messages' },
      { status: 500 }
    )
  }
}

// DELETE /api/messages - Delete all messages for a group
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const groupId = searchParams.get('groupId')

  if (!groupId) {
    return NextResponse.json(
      { error: 'groupId is required' },
      { status: 400 }
    )
  }

  try {
    const result = await prisma.message.deleteMany({
      where: { groupId },
    })

    return NextResponse.json({
      success: true,
      deleted: result.count,
    })
  } catch (error) {
    console.error('Error deleting messages:', error)
    return NextResponse.json(
      { error: 'Failed to delete messages' },
      { status: 500 }
    )
  }
}
