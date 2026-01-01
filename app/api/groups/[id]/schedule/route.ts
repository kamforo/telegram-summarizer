import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { scheduler, SummaryScheduler } from '@/lib/scheduler'
import cron from 'node-cron'

// GET - Get schedule config for a group
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        scheduleEnabled: true,
        scheduleCron: true,
        scheduleTimezone: true,
        schedulePeriod: true,
        lastScheduledRun: true,
      },
    })

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    return NextResponse.json({
      ...group,
      cronDescription: group.scheduleCron
        ? SummaryScheduler.describeCron(group.scheduleCron)
        : null,
      presets: SummaryScheduler.getPresets(),
    })
  } catch (error) {
    console.error('Error fetching schedule:', error)
    return NextResponse.json(
      { error: 'Failed to fetch schedule' },
      { status: 500 }
    )
  }
}

// PUT - Update schedule config
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params
    const body = await request.json()
    const { scheduleEnabled, scheduleCron, scheduleTimezone, schedulePeriod } = body

    // Validate cron if provided
    if (scheduleCron && !cron.validate(scheduleCron)) {
      return NextResponse.json(
        { error: 'Invalid cron expression' },
        { status: 400 }
      )
    }

    // Update group
    const updated = await prisma.group.update({
      where: { id: groupId },
      data: {
        scheduleEnabled: scheduleEnabled ?? false,
        scheduleCron: scheduleCron || null,
        scheduleTimezone: scheduleTimezone || 'UTC',
        schedulePeriod: schedulePeriod || 'daily',
      },
      select: {
        scheduleEnabled: true,
        scheduleCron: true,
        scheduleTimezone: true,
        schedulePeriod: true,
        lastScheduledRun: true,
      },
    })

    // Update scheduler
    if (updated.scheduleEnabled && updated.scheduleCron) {
      scheduler.scheduleGroup(groupId, updated.scheduleCron)
    } else {
      scheduler.unscheduleGroup(groupId)
    }

    return NextResponse.json({
      ...updated,
      cronDescription: updated.scheduleCron
        ? SummaryScheduler.describeCron(updated.scheduleCron)
        : null,
    })
  } catch (error) {
    console.error('Error updating schedule:', error)
    return NextResponse.json(
      { error: 'Failed to update schedule' },
      { status: 500 }
    )
  }
}

// POST - Trigger a manual scheduled run
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params

    // This will trigger the scheduled summary immediately
    // We'll need to export a method from scheduler for this
    return NextResponse.json({
      message: 'Manual trigger not yet implemented',
    })
  } catch (error) {
    console.error('Error triggering schedule:', error)
    return NextResponse.json(
      { error: 'Failed to trigger schedule' },
      { status: 500 }
    )
  }
}
