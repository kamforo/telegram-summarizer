'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

interface SchedulePreset {
  label: string
  cron: string
  period: string
}

interface ScheduleLog {
  id: string
  status: string
  message: string | null
  createdAt: string
}

interface ScheduleConfig {
  scheduleEnabled: boolean
  scheduleCron: string | null
  scheduleTimezone: string
  schedulePeriod: string
  lastScheduledRun: string | null
  cronDescription: string | null
  presets: SchedulePreset[]
}

interface ScheduleConfigProps {
  groupId: string
}

export function ScheduleConfig({ groupId }: ScheduleConfigProps) {
  const [config, setConfig] = useState<ScheduleConfig | null>(null)
  const [logs, setLogs] = useState<ScheduleLog[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [customCron, setCustomCron] = useState('')

  const fetchConfig = async () => {
    try {
      const [configRes, logsRes] = await Promise.all([
        fetch(`/api/groups/${groupId}/schedule`),
        fetch(`/api/groups/${groupId}/schedule/logs?limit=5`),
      ])

      if (configRes.ok) {
        const data = await configRes.json()
        setConfig(data)
        setCustomCron(data.scheduleCron || '')
      }

      if (logsRes.ok) {
        setLogs(await logsRes.json())
      }
    } catch (error) {
      console.error('Failed to fetch schedule config:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConfig()
  }, [groupId])

  const handleSave = async (updates: Partial<ScheduleConfig>) => {
    setSaving(true)
    try {
      const response = await fetch(`/api/groups/${groupId}/schedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          ...updates,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setConfig((prev) => (prev ? { ...prev, ...data } : null))
      }
    } catch (error) {
      console.error('Failed to save schedule:', error)
    } finally {
      setSaving(false)
    }
  }

  const handlePresetSelect = (preset: SchedulePreset) => {
    setCustomCron(preset.cron)
    handleSave({
      scheduleCron: preset.cron,
      schedulePeriod: preset.period,
    })
  }

  const handleCustomCronSave = () => {
    handleSave({ scheduleCron: customCron })
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'no_messages':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      default:
        return null
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    )
  }

  if (!config) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Enable/Disable */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Scheduled Summaries</CardTitle>
              <CardDescription>
                Automatically generate summaries on a schedule
              </CardDescription>
            </div>
            <Switch
              checked={config.scheduleEnabled}
              onCheckedChange={(checked) => handleSave({ scheduleEnabled: checked })}
              disabled={saving}
            />
          </div>
        </CardHeader>
      </Card>

      {config.scheduleEnabled && (
        <>
          {/* Preset Schedules */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Schedule Presets</CardTitle>
              <CardDescription>
                Choose a preset or create a custom cron expression
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {config.presets.map((preset) => (
                  <Button
                    key={preset.cron}
                    variant={config.scheduleCron === preset.cron ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handlePresetSelect(preset)}
                    disabled={saving}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>

              <div className="pt-4 border-t">
                <Label htmlFor="customCron">Custom Cron Expression</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="customCron"
                    value={customCron}
                    onChange={(e) => setCustomCron(e.target.value)}
                    placeholder="0 9 * * *"
                    className="font-mono"
                  />
                  <Button
                    onClick={handleCustomCronSave}
                    disabled={saving || customCron === config.scheduleCron}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Format: minute hour day-of-month month day-of-week
                </p>
              </div>

              {config.cronDescription && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="h-4 w-4" />
                  <span>{config.cronDescription}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary Period */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary Period</CardTitle>
              <CardDescription>
                How far back to look when generating each summary
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={config.schedulePeriod}
                onValueChange={(value) => handleSave({ schedulePeriod: value })}
                disabled={saving}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily (last 24 hours)</SelectItem>
                  <SelectItem value="weekly">Weekly (last 7 days)</SelectItem>
                  <SelectItem value="monthly">Monthly (last 30 days)</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Recent Logs */}
          {logs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Runs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between text-sm py-2 border-b last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        {getStatusIcon(log.status)}
                        <span className="text-gray-600">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <Badge
                        variant={
                          log.status === 'success'
                            ? 'default'
                            : log.status === 'error'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {log.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Last Run Info */}
          {config.lastScheduledRun && (
            <p className="text-sm text-gray-500">
              Last scheduled run: {new Date(config.lastScheduledRun).toLocaleString()}
            </p>
          )}
        </>
      )}
    </div>
  )
}
