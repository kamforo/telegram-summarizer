import cron, { ScheduledTask } from 'node-cron'
import { prisma } from '@/lib/db'
import { generateSummary } from '@/lib/claude'
import { extractTopics } from '@/lib/topic-extraction'

export class SummaryScheduler {
  private tasks: Map<string, ScheduledTask> = new Map()
  private initialized = false

  async initialize(): Promise<void> {
    if (this.initialized) return

    console.log('[Scheduler] Initializing...')

    // Load all groups with schedules enabled
    const groups = await prisma.group.findMany({
      where: {
        scheduleEnabled: true,
        scheduleCron: { not: null },
      },
    })

    for (const group of groups) {
      if (group.scheduleCron) {
        this.scheduleGroup(group.id, group.scheduleCron)
      }
    }

    this.initialized = true
    console.log(`[Scheduler] Initialized with ${groups.length} scheduled groups`)
  }

  scheduleGroup(groupId: string, cronExpression: string): boolean {
    // Validate cron expression
    if (!cron.validate(cronExpression)) {
      console.error(`[Scheduler] Invalid cron expression: ${cronExpression}`)
      return false
    }

    // Cancel existing task if any
    this.unscheduleGroup(groupId)

    // Create new task
    const task = cron.schedule(cronExpression, async () => {
      await this.runScheduledSummary(groupId)
    })

    this.tasks.set(groupId, task)
    console.log(`[Scheduler] Scheduled group ${groupId} with cron: ${cronExpression}`)
    return true
  }

  unscheduleGroup(groupId: string): void {
    const existing = this.tasks.get(groupId)
    if (existing) {
      existing.stop()
      this.tasks.delete(groupId)
      console.log(`[Scheduler] Unscheduled group ${groupId}`)
    }
  }

  private async runScheduledSummary(groupId: string): Promise<void> {
    console.log(`[Scheduler] Running scheduled summary for group ${groupId}`)

    try {
      // Get group config
      const group = await prisma.group.findUnique({
        where: { id: groupId },
      })

      if (!group || !group.scheduleEnabled) {
        console.log(`[Scheduler] Group ${groupId} not found or disabled`)
        return
      }

      // Calculate date range based on period
      const now = new Date()
      let startDate: Date

      switch (group.schedulePeriod) {
        case 'daily':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          break
        case 'weekly':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'monthly':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        default:
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      }

      // Use last scheduled run if available
      if (group.lastScheduledRun) {
        startDate = group.lastScheduledRun
      }

      // Get messages in range
      const messages = await prisma.message.findMany({
        where: {
          groupId,
          timestamp: {
            gte: startDate,
            lte: now,
          },
        },
        orderBy: { timestamp: 'asc' },
      })

      if (messages.length === 0) {
        await prisma.scheduleLog.create({
          data: {
            groupId,
            status: 'no_messages',
            message: `No messages found between ${startDate.toISOString()} and ${now.toISOString()}`,
          },
        })
        console.log(`[Scheduler] No messages for group ${groupId}`)
        return
      }

      // Generate summary
      const result = await generateSummary(
        messages.map((m) => ({
          content: m.content,
          senderName: m.senderName,
          timestamp: m.timestamp,
        })),
        group.summarizationGoal,
        group.customPrompt || undefined
      )

      // Save summary
      const summary = await prisma.summary.create({
        data: {
          groupId,
          period: group.schedulePeriod,
          startDate,
          endDate: now,
          content: result.summary,
          bulletPoints: JSON.stringify(result.bulletPoints),
          followUpSuggestions: JSON.stringify(result.followUpSuggestions),
          messageCount: messages.length,
        },
      })

      // Extract topics
      await extractTopics(summary.id, result.summary, result.bulletPoints)

      // Update last scheduled run
      await prisma.group.update({
        where: { id: groupId },
        data: { lastScheduledRun: now },
      })

      // Log success
      await prisma.scheduleLog.create({
        data: {
          groupId,
          status: 'success',
          message: `Generated ${group.schedulePeriod} summary with ${messages.length} messages`,
          summaryId: summary.id,
        },
      })

      console.log(`[Scheduler] Successfully generated summary for group ${groupId}`)
    } catch (error) {
      console.error(`[Scheduler] Error for group ${groupId}:`, error)

      await prisma.scheduleLog.create({
        data: {
          groupId,
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      })
    }
  }

  // Get human-readable description of cron expression
  static describeCron(cronExpression: string): string {
    const parts = cronExpression.split(' ')
    if (parts.length !== 5) return cronExpression

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts

    // Common patterns
    if (dayOfWeek === '*' && dayOfMonth === '*' && month === '*') {
      // Daily
      return `Daily at ${hour}:${minute.padStart(2, '0')}`
    }

    if (dayOfWeek === '1' && dayOfMonth === '*' && month === '*') {
      // Weekly on Monday
      return `Every Monday at ${hour}:${minute.padStart(2, '0')}`
    }

    if (dayOfMonth === '1' && dayOfWeek === '*' && month === '*') {
      // Monthly on 1st
      return `Monthly on the 1st at ${hour}:${minute.padStart(2, '0')}`
    }

    return cronExpression
  }

  // Get preset cron expressions
  static getPresets(): Array<{ label: string; cron: string; period: string }> {
    return [
      { label: 'Daily at 9 AM', cron: '0 9 * * *', period: 'daily' },
      { label: 'Daily at 6 PM', cron: '0 18 * * *', period: 'daily' },
      { label: 'Every Monday at 9 AM', cron: '0 9 * * 1', period: 'weekly' },
      { label: 'Every Friday at 5 PM', cron: '0 17 * * 5', period: 'weekly' },
      { label: '1st of each month at 9 AM', cron: '0 9 1 * *', period: 'monthly' },
    ]
  }
}

export const scheduler = new SummaryScheduler()
