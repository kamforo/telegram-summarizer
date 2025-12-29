# Telegram Summarizer Roadmap

## Current Features (v1.0)
- [x] Group management (CRUD)
- [x] Message upload (JSON/HTML Telegram exports)
- [x] AI summarization with Claude
- [x] Summary periods (daily, weekly, monthly, all-time, incremental)
- [x] Q&A on summaries
- [x] Markdown formatting
- [x] Password authentication

---

## Planned Features

### Phase 1: Analytics & Insights
- [ ] **Activity Heatmap** - Visualize group activity by hour/day
- [ ] **Topic Trends** - Track topic popularity over time with charts

### Phase 2: AI Enhancements
- [ ] **Custom Prompts per Group** - Fine-tune summarization per group
- [ ] **Follow-up Suggestions** - AI suggests questions after summaries
- [ ] **Post Suggestions** - AI suggests questions and content to share

### Phase 3: Smart Features
- [ ] **Conversation Threading** - Detect and summarize discussion threads
- [ ] **Scheduled Summaries** - Auto-generate summaries via cron

### Phase 4: Telegram Integration
- [ ] **MTProto Integration** - Connect directly to Telegram account
- [ ] **Real-time Sync** - Auto-fetch new messages from groups

---

## Technical Requirements

### New Dependencies
```bash
npm install node-cron recharts telegram
```

### New Database Models
- Topic / TopicMention (for trends)
- Thread / ThreadMessage (for threading)
- PostSuggestion
- TelegramSession / TelegramGroupLink
- ScheduleLog

### Environment Variables (for Phase 4)
```env
TELEGRAM_API_ID=
TELEGRAM_API_HASH=
ENCRYPTION_KEY=
```

---

## Feature Details

### Activity Heatmap
- 7x24 grid (days x hours)
- Color intensity = message count
- Date range filter

### Topic Trends
- Extract topics from summaries via Claude
- Store with frequency counts
- Line/bar chart visualization (recharts)

### Custom Prompts
- Textarea in group settings
- Preset templates (Technical, Q&A, News, etc.)
- Merged with base prompt

### Follow-up Suggestions
- Generated during summarization
- 3-5 suggested questions
- Clickable to populate Q&A input

### Post Suggestions
- Question suggestions (spark discussion)
- Content suggestions (share insights)
- Copy to clipboard, mark as used

### Conversation Threading
- Claude detects topic clusters
- Groups related messages
- Per-thread summaries

### Scheduled Summaries
- Enable per group
- Cron expression or friendly picker
- Timezone support
- Execution logs

### Telegram MTProto
- Phone + code + 2FA auth flow
- Session management
- Link groups to Telegram chats
- Manual or auto sync
