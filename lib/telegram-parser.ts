import { parse as parseHTML } from 'node-html-parser'

export interface TelegramMessage {
  id: number
  type: string
  date: string
  date_unixtime: string
  from: string
  from_id: string
  text: string | Array<{ type: string; text: string }>
  text_entities?: Array<{ type: string; text: string }>
}

export interface TelegramExport {
  name: string
  type: string
  id: number
  messages: TelegramMessage[]
}

export interface ParsedMessage {
  content: string
  senderName: string | null
  timestamp: Date
}

export interface ParsedExport {
  messages: ParsedMessage[]
  groupName: string
  totalItems: number
}

function extractTextContent(text: string | Array<{ type: string; text: string }>): string {
  if (typeof text === 'string') {
    return text
  }

  if (Array.isArray(text)) {
    return text.map(part => {
      if (typeof part === 'string') return part
      if (part.text) return part.text
      return ''
    }).join('')
  }

  return ''
}

// Parse JSON export format
export function parseTelegramJSON(jsonData: TelegramExport): ParsedExport {
  const messages: ParsedMessage[] = []

  if (!jsonData.messages || !Array.isArray(jsonData.messages)) {
    throw new Error('Invalid Telegram export format: messages array not found')
  }

  for (const msg of jsonData.messages) {
    if (msg.type !== 'message') {
      continue
    }

    const content = extractTextContent(msg.text)

    if (!content.trim()) {
      continue
    }

    let timestamp: Date
    if (msg.date_unixtime) {
      timestamp = new Date(parseInt(msg.date_unixtime) * 1000)
    } else if (msg.date) {
      timestamp = new Date(msg.date)
    } else {
      continue
    }

    messages.push({
      content: content.trim(),
      senderName: msg.from || null,
      timestamp,
    })
  }

  return {
    messages,
    groupName: jsonData.name || 'Unknown Group',
    totalItems: jsonData.messages.length,
  }
}

// Parse HTML export format
export function parseTelegramHTML(htmlContent: string): ParsedExport {
  const root = parseHTML(htmlContent)
  const messages: ParsedMessage[] = []

  // Get group name from page title or header
  const titleEl = root.querySelector('.page_header .content .text')
    || root.querySelector('title')
    || root.querySelector('.page_header')
  const groupName = titleEl?.text?.trim() || 'Unknown Group'

  // Find all message elements
  const messageElements = root.querySelectorAll('.message.default')

  let lastSender: string | null = null

  for (const msgEl of messageElements) {
    // Get sender name (may be in a joined message without from_name)
    const fromNameEl = msgEl.querySelector('.from_name')
    if (fromNameEl) {
      lastSender = fromNameEl.text.trim()
    }

    // Get message text
    const textEl = msgEl.querySelector('.text')
    if (!textEl) continue

    const content = textEl.text.trim()
    if (!content) continue

    // Get timestamp from date element
    const dateEl = msgEl.querySelector('.date')
    if (!dateEl) continue

    // Try to get full date from title attribute
    const dateTitle = dateEl.getAttribute('title')
    let timestamp: Date

    if (dateTitle) {
      // Format: "01.01.2024 12:00:00" or "DD.MM.YYYY HH:MM:SS"
      const parts = dateTitle.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):?(\d{2})?/)
      if (parts) {
        const [, day, month, year, hour, minute, second = '00'] = parts
        timestamp = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          parseInt(hour),
          parseInt(minute),
          parseInt(second)
        )
      } else {
        // Try parsing as-is
        timestamp = new Date(dateTitle)
      }
    } else {
      // Fallback to current date
      timestamp = new Date()
    }

    if (isNaN(timestamp.getTime())) {
      continue
    }

    messages.push({
      content,
      senderName: lastSender,
      timestamp,
    })
  }

  return {
    messages,
    groupName,
    totalItems: messageElements.length,
  }
}

// Detect format and parse accordingly
export function parseExport(content: string): ParsedExport {
  const trimmed = content.trim()

  // Check if it's JSON
  if (trimmed.startsWith('{')) {
    try {
      const json = JSON.parse(trimmed)
      if (validateTelegramJSON(json)) {
        return parseTelegramJSON(json)
      }
    } catch {
      // Not valid JSON, try HTML
    }
  }

  // Check if it's HTML
  if (trimmed.includes('<!DOCTYPE') || trimmed.includes('<html') || trimmed.includes('<div class="message')) {
    return parseTelegramHTML(trimmed)
  }

  throw new Error('Unrecognized export format. Please use Telegram Desktop to export as JSON or HTML.')
}

export function validateTelegramJSON(data: unknown): data is TelegramExport {
  if (!data || typeof data !== 'object') {
    return false
  }

  const obj = data as Record<string, unknown>

  if (!Array.isArray(obj.messages)) {
    return false
  }

  return true
}

// Legacy function for backward compatibility
export function parseTelegramExport(jsonData: TelegramExport): ParsedMessage[] {
  return parseTelegramJSON(jsonData).messages
}

export function validateTelegramExport(data: unknown): data is TelegramExport {
  return validateTelegramJSON(data)
}

export function getExportInfo(data: TelegramExport): {
  groupName: string
  totalMessages: number
  validMessages: number
  dateRange: { start: Date | null; end: Date | null }
} {
  const parsed = parseTelegramJSON(data)

  let start: Date | null = null
  let end: Date | null = null

  for (const msg of parsed.messages) {
    if (!start || msg.timestamp < start) {
      start = msg.timestamp
    }
    if (!end || msg.timestamp > end) {
      end = msg.timestamp
    }
  }

  return {
    groupName: parsed.groupName,
    totalMessages: parsed.totalItems,
    validMessages: parsed.messages.length,
    dateRange: { start, end },
  }
}

export function getExportInfoFromParsed(parsed: ParsedExport): {
  groupName: string
  totalMessages: number
  validMessages: number
  dateRange: { start: Date | null; end: Date | null }
} {
  let start: Date | null = null
  let end: Date | null = null

  for (const msg of parsed.messages) {
    if (!start || msg.timestamp < start) {
      start = msg.timestamp
    }
    if (!end || msg.timestamp > end) {
      end = msg.timestamp
    }
  }

  return {
    groupName: parsed.groupName,
    totalMessages: parsed.totalItems,
    validMessages: parsed.messages.length,
    dateRange: { start, end },
  }
}
