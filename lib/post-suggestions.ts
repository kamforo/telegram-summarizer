import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface PostSuggestion {
  type: 'question' | 'content'
  title: string
  content: string
  reasoning: string
}

export async function generatePostSuggestions(
  recentSummaries: Array<{ content: string; bulletPoints: string }>,
  groupGoal: string,
  topicNames: string[]
): Promise<PostSuggestion[]> {
  if (recentSummaries.length === 0) {
    return []
  }

  // Format summaries for the prompt
  const summariesText = recentSummaries
    .map((s, i) => {
      const bullets = JSON.parse(s.bulletPoints)
      return `Summary ${i + 1}:\n${s.content}\n\nKey Points:\n${bullets.map((b: string) => `- ${b}`).join('\n')}`
    })
    .join('\n\n---\n\n')

  const topicsText = topicNames.length > 0
    ? `\nFrequently discussed topics: ${topicNames.join(', ')}`
    : ''

  const prompt = `You are an expert community manager helping to create engaging posts for a Telegram group.

**Group Purpose:** ${groupGoal}
${topicsText}

**Recent Discussion Summaries:**
${summariesText}

---

Based on the recent discussions, generate 3-4 post suggestions that would be valuable for this group. Create a mix of:

1. **Questions** - Thought-provoking questions to spark discussion, based on topics that were mentioned but not fully explored
2. **Content** - Helpful information, insights, or resources that would add value based on what the group is interested in

For each suggestion, provide:
- type: "question" or "content"
- title: A short title (3-6 words)
- content: The actual post text (1-3 sentences for questions, 2-4 sentences for content)
- reasoning: Why this would be valuable for the group (1 sentence)

Return ONLY a JSON array in this exact format, no other text:
[
  {
    "type": "question",
    "title": "Example Title",
    "content": "What do you think about...?",
    "reasoning": "This topic was mentioned but needs more discussion."
  }
]`

  try {
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

    // Parse JSON response
    const jsonMatch = textContent.text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error('Failed to parse post suggestions JSON:', textContent.text)
      return []
    }

    const suggestions: PostSuggestion[] = JSON.parse(jsonMatch[0])

    // Validate and normalize
    return suggestions
      .filter((s) => s.type && s.title && s.content)
      .map((s) => ({
        type: s.type === 'question' ? 'question' : 'content',
        title: s.title.substring(0, 100),
        content: s.content,
        reasoning: s.reasoning || '',
      }))
  } catch (error) {
    console.error('Error generating post suggestions:', error)
    return []
  }
}
