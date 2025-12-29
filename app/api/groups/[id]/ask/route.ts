import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params
    const { question, summaryId } = await request.json()

    if (!question) {
      return NextResponse.json(
        { error: 'Question is required' },
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

    // Get messages - if summaryId provided, get messages from that summary's date range
    let messages
    if (summaryId) {
      const summary = await prisma.summary.findUnique({
        where: { id: summaryId },
      })
      if (summary) {
        messages = await prisma.message.findMany({
          where: {
            groupId,
            timestamp: {
              gte: summary.startDate,
              lte: summary.endDate,
            },
          },
          orderBy: { timestamp: 'asc' },
        })
      }
    }

    // Fallback to all messages if no summary or messages found
    if (!messages || messages.length === 0) {
      messages = await prisma.message.findMany({
        where: { groupId },
        orderBy: { timestamp: 'asc' },
        take: 1000, // Limit to prevent token overflow
      })
    }

    if (messages.length === 0) {
      return NextResponse.json(
        { error: 'No messages found to search' },
        { status: 400 }
      )
    }

    // Format messages for context
    const formattedMessages = messages
      .map((msg) => {
        const sender = msg.senderName || 'Unknown'
        const date = new Date(msg.timestamp).toLocaleString()
        return `[${date}] ${sender}: ${msg.content}`
      })
      .join('\n')

    const prompt = `You are a helpful assistant answering questions about a Telegram group conversation.

IMPORTANT RULES:
1. ONLY use information from the messages provided below. Do not make up or infer information.
2. If the answer is not found in the messages, say "I couldn't find information about that in the messages."
3. When possible, quote or reference specific messages to support your answer.
4. Be concise but thorough.
5. If the question is ambiguous, ask for clarification.

GROUP: ${group.name}
GROUP PURPOSE: ${group.summarizationGoal}

MESSAGES FROM THE GROUP:
${formattedMessages}

---

USER QUESTION: ${question}

Please answer based ONLY on the messages above:`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const textContent = response.content.find((block) => block.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    return NextResponse.json({
      answer: textContent.text,
      messageCount: messages.length,
    })
  } catch (error) {
    console.error('Error answering question:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to answer question' },
      { status: 500 }
    )
  }
}
