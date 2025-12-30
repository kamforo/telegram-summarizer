import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface ExtractedTopic {
  name: string
  frequency: number
}

export async function extractTopics(
  summaryContent: string,
  bulletPoints: string[]
): Promise<ExtractedTopic[]> {
  const bulletText = bulletPoints.join('\n')

  const prompt = `Analyze the following summary and bullet points from a group chat conversation. Extract the main topics discussed.

SUMMARY:
${summaryContent}

BULLET POINTS:
${bulletText}

---

Extract 5-10 key topics from this content. For each topic:
1. Use a short, clear name (2-4 words max, e.g., "Bitcoin Price", "Technical Analysis", "Market Sentiment")
2. Estimate how prominently it was discussed (frequency 1-5, where 5 is most discussed)

Return ONLY a JSON array in this exact format, no other text:
[{"name": "Topic Name", "frequency": 3}, {"name": "Another Topic", "frequency": 5}]

Important:
- Keep topic names concise and specific
- Normalize similar topics (e.g., "BTC" and "Bitcoin" should be "Bitcoin")
- Focus on substantive topics, not generic ones like "Discussion" or "Chat"
- Return valid JSON only`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
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

    // Parse JSON response
    const jsonMatch = textContent.text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error('Failed to parse topics JSON:', textContent.text)
      return []
    }

    const topics: ExtractedTopic[] = JSON.parse(jsonMatch[0])

    // Validate and normalize
    return topics
      .filter((t) => t.name && typeof t.frequency === 'number')
      .map((t) => ({
        name: t.name.trim().substring(0, 50), // Limit name length
        frequency: Math.min(Math.max(t.frequency, 1), 5), // Clamp to 1-5
      }))
  } catch (error) {
    console.error('Error extracting topics:', error)
    return []
  }
}
