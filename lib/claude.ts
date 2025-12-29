import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface SummaryResult {
  summary: string
  bulletPoints: string[]
}

export async function generateSummary(
  messages: Array<{ content: string; senderName: string | null; timestamp: Date }>,
  summarizationGoal: string
): Promise<SummaryResult> {
  if (messages.length === 0) {
    throw new Error('No messages to summarize')
  }

  // Format messages for the prompt
  const formattedMessages = messages
    .map((msg) => {
      const sender = msg.senderName || 'Unknown'
      const date = new Date(msg.timestamp).toLocaleString()
      return `[${date}] ${sender}: ${msg.content}`
    })
    .join('\n')

  const prompt = `You are an expert at analyzing and summarizing group chat conversations. Your task is to analyze the following Telegram group messages and create a comprehensive, well-formatted summary.

**Summarization Goal:** ${summarizationGoal}

**Messages to analyze:**
${formattedMessages}

---

Please provide a well-structured summary in the following format:

SUMMARY:
Write 2-3 paragraphs that capture the main themes and discussions. Use markdown formatting:
- Use **bold** for important terms, names, or concepts
- Use *italics* for emphasis
- Include specific details, numbers, or quotes when relevant
- Organize information logically

BULLET_POINTS:
Create 5-10 key bullet points. For each point:
- Start with a clear topic or category in **bold**
- Provide specific details from the messages
- Include relevant quotes or data when available
- Format: **Topic**: Detail about this topic

Example bullet format:
- **Price Discussion**: Users discussed BTC reaching $50k, with @john predicting further upside
- **Technical Analysis**: Multiple mentions of support levels at $48k

Focus specifically on information relevant to the summarization goal. Be specific and reference actual content from the messages.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2500,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  // Extract text content from response
  const textContent = response.content.find((block) => block.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  const responseText = textContent.text

  // Parse the response
  const summaryMatch = responseText.match(/SUMMARY:\s*([\s\S]*?)(?=BULLET_POINTS:|$)/i)
  const bulletMatch = responseText.match(/BULLET_POINTS:\s*([\s\S]*?)$/i)

  const summary = summaryMatch ? summaryMatch[1].trim() : responseText
  const bulletText = bulletMatch ? bulletMatch[1].trim() : ''

  // Parse bullet points - preserve markdown formatting
  const bulletPoints = bulletText
    .split('\n')
    .map((line) => line.replace(/^[-•*]\s*/, '').trim())
    .filter((line) => line.length > 0)

  return {
    summary,
    bulletPoints: bulletPoints.length > 0 ? bulletPoints : ['No specific bullet points extracted'],
  }
}
