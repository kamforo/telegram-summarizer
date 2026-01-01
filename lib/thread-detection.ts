import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface MessageForThreading {
  id: string
  content: string
  senderName: string | null
  timestamp: Date
}

export interface DetectedThread {
  title: string
  messageIds: string[]
  startTime: Date
  endTime: Date
}

export async function detectThreads(
  messages: MessageForThreading[]
): Promise<DetectedThread[]> {
  if (messages.length < 5) {
    return []
  }

  // Format messages with indices for Claude
  const formattedMessages = messages
    .map((msg, idx) => {
      const sender = msg.senderName || 'Unknown'
      const date = new Date(msg.timestamp).toLocaleString()
      return `[${idx}] [${date}] ${sender}: ${msg.content}`
    })
    .join('\n')

  const prompt = `Analyze these Telegram group messages and identify distinct conversation threads or topic clusters.

A thread is a group of related messages discussing the same topic, question, or event. Messages in a thread should be:
- Topically related (discussing the same subject)
- Relatively close in time (within hours of each other)
- At least 3 messages per thread

**Messages:**
${formattedMessages}

---

Identify the main conversation threads. For each thread, output in this exact format:

THREAD:
TITLE: [Short descriptive title for this conversation]
MESSAGES: [comma-separated list of message indices, e.g., 0,1,2,5,6]

Rules:
- Only include threads with 3+ messages
- A message can only belong to one thread
- Focus on substantive discussions, not just greetings or short exchanges
- Limit to the 5 most significant threads

Output only THREAD blocks, nothing else.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  })

  const textContent = response.content.find((block) => block.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    return []
  }

  const responseText = textContent.text
  const threads: DetectedThread[] = []

  // Parse THREAD blocks
  const threadBlocks = responseText.split(/THREAD:/i).filter((b) => b.trim())

  for (const block of threadBlocks) {
    const titleMatch = block.match(/TITLE:\s*(.+)/i)
    const messagesMatch = block.match(/MESSAGES:\s*([\d,\s]+)/i)

    if (titleMatch && messagesMatch) {
      const title = titleMatch[1].trim()
      const indices = messagesMatch[1]
        .split(',')
        .map((s) => parseInt(s.trim()))
        .filter((n) => !isNaN(n) && n >= 0 && n < messages.length)

      if (indices.length >= 3) {
        const threadMessages = indices.map((i) => messages[i])
        const timestamps = threadMessages.map((m) => new Date(m.timestamp).getTime())

        threads.push({
          title,
          messageIds: indices.map((i) => messages[i].id),
          startTime: new Date(Math.min(...timestamps)),
          endTime: new Date(Math.max(...timestamps)),
        })
      }
    }
  }

  return threads
}

export async function summarizeThread(
  messages: MessageForThreading[],
  title: string
): Promise<string> {
  if (messages.length === 0) {
    return 'No messages to summarize'
  }

  const formattedMessages = messages
    .map((msg) => {
      const sender = msg.senderName || 'Unknown'
      const date = new Date(msg.timestamp).toLocaleString()
      return `[${date}] ${sender}: ${msg.content}`
    })
    .join('\n')

  const prompt = `Summarize this conversation thread titled "${title}".

**Messages:**
${formattedMessages}

---

Write a concise summary (2-4 sentences) that captures:
- The main topic or question being discussed
- Key points or conclusions reached
- Any decisions made or action items mentioned

Use markdown formatting for emphasis where appropriate.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  })

  const textContent = response.content.find((block) => block.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    return 'Failed to generate summary'
  }

  return textContent.text.trim()
}
