import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generatePostSuggestions } from '@/lib/post-suggestions'

// GET - List post suggestions for a group
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params

    const suggestions = await prisma.postSuggestion.findMany({
      where: { groupId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(suggestions)
  } catch (error) {
    console.error('Error fetching post suggestions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch post suggestions' },
      { status: 500 }
    )
  }
}

// POST - Generate new post suggestions
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params

    // Get the group
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    })

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Get recent summaries
    const recentSummaries = await prisma.summary.findMany({
      where: { groupId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        content: true,
        bulletPoints: true,
      },
    })

    if (recentSummaries.length === 0) {
      return NextResponse.json(
        { error: 'No summaries found. Generate some summaries first.' },
        { status: 400 }
      )
    }

    // Get top topics
    const topics = await prisma.topic.findMany({
      where: { groupId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { name: true },
    })

    const topicNames = topics.map((t) => t.name)

    // Generate suggestions
    const suggestions = await generatePostSuggestions(
      recentSummaries,
      group.summarizationGoal,
      topicNames
    )

    if (suggestions.length === 0) {
      return NextResponse.json(
        { error: 'Failed to generate suggestions' },
        { status: 500 }
      )
    }

    // Save suggestions to database
    const created = await prisma.postSuggestion.createMany({
      data: suggestions.map((s) => ({
        groupId,
        type: s.type,
        title: s.title,
        content: s.content,
        reasoning: s.reasoning,
      })),
    })

    // Fetch and return the created suggestions
    const newSuggestions = await prisma.postSuggestion.findMany({
      where: { groupId },
      orderBy: { createdAt: 'desc' },
      take: suggestions.length,
    })

    return NextResponse.json({
      message: `Generated ${created.count} suggestions`,
      suggestions: newSuggestions,
    })
  } catch (error) {
    console.error('Error generating post suggestions:', error)
    return NextResponse.json(
      { error: 'Failed to generate post suggestions' },
      { status: 500 }
    )
  }
}

// PATCH - Mark suggestion as used
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { suggestionId, used } = await request.json()

    if (!suggestionId) {
      return NextResponse.json(
        { error: 'suggestionId is required' },
        { status: 400 }
      )
    }

    const updated = await prisma.postSuggestion.update({
      where: { id: suggestionId },
      data: { used: used ?? true },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating post suggestion:', error)
    return NextResponse.json(
      { error: 'Failed to update post suggestion' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a suggestion
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const suggestionId = searchParams.get('suggestionId')

    if (!suggestionId) {
      return NextResponse.json(
        { error: 'suggestionId is required' },
        { status: 400 }
      )
    }

    await prisma.postSuggestion.delete({
      where: { id: suggestionId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting post suggestion:', error)
    return NextResponse.json(
      { error: 'Failed to delete post suggestion' },
      { status: 500 }
    )
  }
}
