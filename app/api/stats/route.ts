import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const recentSummaries = await prisma.summary.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        group: {
          select: { name: true },
        },
      },
    })

    return NextResponse.json({
      recentSummaries,
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
