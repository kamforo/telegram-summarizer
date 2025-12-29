'use client'

import { useState, use } from 'react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/dashboard/layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Upload, FolderOpen, Check, AlertCircle, X } from 'lucide-react'
import { parseExport, getExportInfoFromParsed, type ParsedExport } from '@/lib/telegram-parser'

interface CombinedInfo {
  files: string[]
  totalMessages: number
  validMessages: number
  dateRange: { start: Date | null; end: Date | null }
}

export default function UploadPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const [files, setFiles] = useState<File[]>([])
  const [combinedContent, setCombinedContent] = useState<string[]>([])
  const [combinedInfo, setCombinedInfo] = useState<CombinedInfo | null>(null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    if (selectedFiles.length === 0) return

    setError('')
    setResult(null)

    // Sort files: messages.html first, then messages2.html, messages3.html, etc.
    const sortedFiles = selectedFiles.sort((a, b) => {
      const getNum = (name: string) => {
        const match = name.match(/messages(\d*)\.html?$/i)
        if (!match) return 999
        return match[1] ? parseInt(match[1]) : 0
      }
      return getNum(a.name) - getNum(b.name)
    })

    setFiles(sortedFiles)

    try {
      const contents: string[] = []
      let totalValid = 0
      let totalItems = 0
      let start: Date | null = null
      let end: Date | null = null

      for (const file of sortedFiles) {
        const text = await file.text()
        contents.push(text)

        const parsed = parseExport(text)
        const info = getExportInfoFromParsed(parsed)

        totalValid += info.validMessages
        totalItems += info.totalMessages

        if (info.dateRange.start && (!start || info.dateRange.start < start)) {
          start = info.dateRange.start
        }
        if (info.dateRange.end && (!end || info.dateRange.end > end)) {
          end = info.dateRange.end
        }
      }

      setCombinedContent(contents)
      setCombinedInfo({
        files: sortedFiles.map(f => f.name),
        totalMessages: totalItems,
        validMessages: totalValid,
        dateRange: { start, end },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse files')
      setCombinedContent([])
      setCombinedInfo(null)
    }
  }

  const handleUpload = async () => {
    if (combinedContent.length === 0) return

    setUploading(true)
    setError('')

    let totalImported = 0
    let totalSkipped = 0

    try {
      // Upload each file's content
      for (const content of combinedContent) {
        const response = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            groupId: resolvedParams.id,
            content,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Upload failed')
        }

        totalImported += data.imported
        totalSkipped += data.skipped
      }

      setResult({ imported: totalImported, skipped: totalSkipped })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const clearFiles = () => {
    setFiles([])
    setCombinedContent([])
    setCombinedInfo(null)
    setResult(null)
    setError('')
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href={`/groups/${resolvedParams.id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Upload Messages</h1>
            <p className="text-gray-500">Import messages from Telegram export (supports multiple files)</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>How to Export from Telegram</CardTitle>
            <CardDescription>
              Follow these steps to export your chat history
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p>1. Open Telegram Desktop (not mobile)</p>
            <p>2. Open the group/channel you want to export</p>
            <p>3. Click the three dots menu → Export chat history</p>
            <p>4. Uncheck all media options</p>
            <p>5. Select <strong>JSON</strong> or <strong>HTML</strong> format</p>
            <p>6. Click Export</p>
            <p>7. Select all <code>messages*.html</code> files and upload them here</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Select Files</CardTitle>
            <CardDescription>
              Upload Telegram export files (select multiple with Cmd/Ctrl+click)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".json,.html,.htm"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="file-input"
              />
              <label
                htmlFor="file-input"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <FolderOpen className="h-12 w-12 text-gray-400" />
                <p className="text-gray-600 dark:text-gray-400">
                  {files.length > 0
                    ? `${files.length} file${files.length > 1 ? 's' : ''} selected`
                    : 'Click to select files'}
                </p>
                <p className="text-sm text-gray-500">
                  Select all messages*.html files from your export folder
                </p>
              </label>
            </div>

            {files.length > 0 && !result && (
              <div className="flex flex-wrap gap-2">
                {files.map((file, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm">
                    {file.name}
                  </span>
                ))}
                <button
                  onClick={clearFiles}
                  className="inline-flex items-center gap-1 px-2 py-1 text-gray-500 hover:text-red-500 text-sm"
                >
                  <X className="h-3 w-3" /> Clear
                </button>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-red-500 text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            {combinedInfo && !result && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
                <h3 className="font-medium">Export Preview</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Files:</span>{' '}
                    <span className="font-medium">{combinedInfo.files.length}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Valid Messages:</span>{' '}
                    <span className="font-medium">{combinedInfo.validMessages.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Total Items:</span>{' '}
                    <span className="font-medium">{combinedInfo.totalMessages.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Date Range:</span>{' '}
                    <span className="font-medium">
                      {combinedInfo.dateRange.start?.toLocaleDateString() || 'N/A'} - {combinedInfo.dateRange.end?.toLocaleDateString() || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {result && (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <Check className="h-5 w-5" />
                  <span className="font-medium">Upload Complete</span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <p>Imported: {result.imported.toLocaleString()} messages</p>
                  <p>Skipped (duplicates): {result.skipped.toLocaleString()} messages</p>
                </div>
                <div className="pt-2">
                  <Link href={`/groups/${resolvedParams.id}/summarize`}>
                    <Button size="sm">
                      Generate Summary
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {combinedInfo && !result && (
              <Button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full"
              >
                <Upload className="mr-2 h-4 w-4" />
                {uploading ? 'Uploading...' : `Import ${combinedInfo.validMessages.toLocaleString()} Messages`}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
