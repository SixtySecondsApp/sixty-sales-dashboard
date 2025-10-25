# Fathom API Fields Analysis

## Fields We're Currently Capturing ✅

### From Bulk Meetings API:
- `recording_id` → `fathom_recording_id`
- `title` / `meeting_title` → `title`
- `share_url` → `share_url`
- `url` → `calls_url`
- `recording_start_time` → `meeting_start`
- `recording_end_time` → `meeting_end`
- `duration` (calculated) → `duration_minutes`
- `recorded_by.email` → `owner_email`
- `recorded_by.team` → `team_name`
- `calendar_invitees` → `meeting_attendees` table
- `default_summary` → `summary`
- `transcript` → `transcript_doc_url`

### From Separate API Endpoints:
- Summary (via `/recordings/{id}/summary`)
- Transcript (via `/recordings/{id}/transcript`)
- Action Items (via `/recordings/{id}/action_items`) - **JUST ADDED**

### Generated Fields:
- `fathom_embed_url` (built from share_url)
- `thumbnail_url` (scraped from og:image or generated placeholder)

---

## Fields Available But NOT Captured ⚠️

### Meeting Metadata:
1. **`created_at`** - When the recording was created in Fathom
   - Use case: Track when meetings were recorded vs when they happened

2. **`transcript_language`** - Language code (e.g., "en")
   - Use case: Multi-language support, filtering

3. **`calendar_invitees_domains_type`** - Enum: "one_or_more_external", "all_internal"
   - Use case: Quick filter for external vs internal meetings
   - Currently we calculate this from attendees, but having it pre-computed could be useful

4. **`crm_matches`** - CRM system matches (if Fathom integration enabled)
   - Use case: Link to external CRM records

### Recording Details (May need separate endpoint):
5. **Speakers** - Individual speaker data with talk time
6. **Questions Asked** - Key questions identified by AI
7. **Topics** - Main topics discussed
8. **Sentiment by Speaker** - Per-person sentiment analysis
9. **Keywords/Tags** - AI-generated tags
10. **Highlights/Key Moments** - Timestamp-based highlights

### Analytics (May need separate endpoint):
11. **Talk Speed** - Words per minute analysis
12. **Question Rate** - Questions asked per minute
13. **Engagement Metrics** - Interaction patterns
14. **Filler Words** - Um, uh, like frequency
15. **Custom Vocabulary** - Industry-specific terms used

---

## Recommendations

### High Priority (Should Add):
1. ✅ **Action Items via separate endpoint** - Already implemented
2. **`created_at`** - Add to meetings table for audit trail
3. **`transcript_language`** - Useful for international teams
4. **Speakers data** - Valuable for talk time analysis by person

### Medium Priority (Nice to Have):
5. **Questions/Highlights** - If available via API
6. **Topics/Keywords** - For search and categorization
7. **`calendar_invitees_domains_type`** - Quick external meeting filter

### Low Priority (Can Calculate):
8. **Talk speed, filler words** - Would need transcript analysis
9. **CRM matches** - Only if using Fathom's CRM integration

---

## Missing Database Columns

Based on API fields, we should add:
```sql
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS fathom_created_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS transcript_language TEXT,
ADD COLUMN IF NOT EXISTS calendar_invitees_type TEXT CHECK (calendar_invitees_type IN ('all_internal', 'one_or_more_external')),
ADD COLUMN IF NOT EXISTS crm_matches JSONB;
```

We should also create tables for:
- `meeting_speakers` - Individual speaker analytics
- `meeting_highlights` - Key moments/highlights with timestamps
- `meeting_topics` - AI-identified topics
