import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface SummaryResult {
  summary: string
  bulletPoints: string[]
  followUpSuggestions: string[]
}

export async function generateSummary(
  messages: Array<{ content: string; senderName: string | null; timestamp: Date }>,
  summarizationGoal: string,
  customPrompt?: string
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

  // Use custom prompt if provided, otherwise use default
  const baseInstructions = customPrompt
    ? `${customPrompt}\n\n**Summarization Goal:** ${summarizationGoal}`
    : `You are an expert at analyzing and summarizing group chat conversations. Your task is to analyze the following Telegram group messages and create a comprehensive, well-formatted summary.\n\n**Summarization Goal:** ${summarizationGoal}`

  const prompt = `${baseInstructions}

**Messages to analyze:**
${formattedMessages}

---

Please provide a well-structured response in the following format:

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

FOLLOW_UP_SUGGESTIONS:
Generate 3-5 insightful follow-up questions that the reader might want to ask about this discussion. Focus on:
- Clarifying ambiguous points mentioned in the messages
- Exploring decisions or opinions that were discussed
- Understanding context that wasn't fully explained
- Digging deeper into interesting topics

Format as a simple numbered list of questions.

Focus specifically on information relevant to the summarization goal. Be specific and reference actual content from the messages.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
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
  const bulletMatch = responseText.match(/BULLET_POINTS:\s*([\s\S]*?)(?=FOLLOW_UP_SUGGESTIONS:|$)/i)
  const followUpMatch = responseText.match(/FOLLOW_UP_SUGGESTIONS:\s*([\s\S]*?)$/i)

  const summary = summaryMatch ? summaryMatch[1].trim() : responseText
  const bulletText = bulletMatch ? bulletMatch[1].trim() : ''
  const followUpText = followUpMatch ? followUpMatch[1].trim() : ''

  // Parse bullet points - preserve markdown formatting
  const bulletPoints = bulletText
    .split('\n')
    .map((line) => line.replace(/^[-•*]\s*/, '').trim())
    .filter((line) => line.length > 0)

  // Parse follow-up suggestions
  const followUpSuggestions = followUpText
    .split('\n')
    .map((line) => line.replace(/^\d+[\.\)]\s*/, '').trim())
    .filter((line) => line.length > 0 && line.endsWith('?'))

  return {
    summary,
    bulletPoints: bulletPoints.length > 0 ? bulletPoints : ['No specific bullet points extracted'],
    followUpSuggestions: followUpSuggestions.length > 0 ? followUpSuggestions : [],
  }
}
