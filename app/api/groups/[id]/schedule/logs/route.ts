import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET - Get schedule logs for a group
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')

    const logs = await prisma.scheduleLog.findMany({
      where: { groupId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json(logs)
  } catch (error) {
    console.error('Error fetching schedule logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch schedule logs' },
      { status: 500 }
    )
  }
}

// DELETE - Clear logs for a group
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params

    await prisma.scheduleLog.deleteMany({
      where: { groupId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error clearing schedule logs:', error)
    return NextResponse.json(
      { error: 'Failed to clear schedule logs' },
      { status: 500 }
    )
  }
}
