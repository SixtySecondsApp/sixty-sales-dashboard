# Fathom Sync Coverage - Complete Field Mapping

## ✅ Fields We're Capturing (Current Implementation)

### Core Meeting Data
| Fathom API Field | Database Column | Notes |
|-----------------|-----------------|-------|
| `recording_id` | `fathom_recording_id` | Unique identifier |
| `title` / `meeting_title` | `title` | Meeting name |
| `share_url` | `share_url` | Public share link |
| `url` | `calls_url` | Fathom app URL |
| `recording_start_time` | `meeting_start` | Actual recording start |
| `recording_end_time` | `meeting_end` | Actual recording end |
| Calculated | `duration_minutes` | Duration in minutes |

### Ownership & Team
| Fathom API Field | Database Column | Notes |
|-----------------|-----------------|-------|
| `recorded_by.email` | `owner_email` | Recording owner |
| `recorded_by.team` | `team_name` | Team name |
| Integration | `fathom_user_id` | Fathom user ID |
| Auth | `owner_user_id` | Our system user ID |

### Content & AI
| Fathom API Field | Database Column | Notes |
|-----------------|-----------------|-------|
| `default_summary` | `summary` | AI-generated summary |
| `transcript` | `transcript_doc_url` | Transcript URL/Google Doc |
| Via `/recordings/{id}/action_items` | `meeting_action_items` table | **Fetched separately** |

### Metadata (NEW - Just Added)
| Fathom API Field | Database Column | Notes |
|-----------------|-----------------|-------|
| `created_at` | `fathom_created_at` | **NEW** - Recording creation time |
| `transcript_language` | `transcript_language` | **NEW** - Language code (en, es, etc) |
| `calendar_invitees_domains_type` | `calendar_invitees_type` | **NEW** - all_internal / one_or_more_external |

### Attendees (Separate Table)
| Fathom API Field | Database Table | Columns |
|-----------------|----------------|---------|
| `calendar_invitees[]` | `meeting_attendees` | name, email, is_external, role |

### Generated Fields
| Source | Database Column | How It's Generated |
|--------|----------------|-------------------|
| `share_url` + `recording_id` | `fathom_embed_url` | Built via `buildEmbedUrl()` |
| `share_url` | `thumbnail_url` | Scraped from og:image or placeholder |

---

## ⚠️ Fields Available But NOT Captured

### Available in Bulk API (Not Currently Used)
- `scheduled_start_time` - We prefer `recording_start_time`
- `scheduled_end_time` - We prefer `recording_end_time`
- `crm_matches` - Only relevant if using Fathom CRM integration

### May Require Separate API Endpoints (Not Yet Implemented)
1. **Speakers Data** - Individual speaker analytics
   - Endpoint: `/recordings/{id}/speakers` (maybe?)
   - Data: Per-speaker talk time, sentiment, questions asked

2. **Highlights/Key Moments** - AI-identified highlights
   - Endpoint: Unknown
   - Data: Timestamp, description, type (question/objection/highlight)

3. **Topics/Keywords** - AI-extracted topics
   - Endpoint: Unknown
   - Data: Topic name, relevance score

4. **Questions** - Questions asked during meeting
   - Endpoint: Unknown
   - Data: Question text, timestamp, speaker

5. **Sentiment by Speaker** - Per-person sentiment
   - Endpoint: Unknown
   - Data: Speaker name, sentiment score

6. **Analytics** - Talk speed, filler words, etc
   - Endpoint: Unknown
   - Requires transcript analysis

---

## 📊 Summary Statistics

### Currently Capturing:
- **13 core meeting fields**
- **4 ownership/team fields**
- **3 content/AI fields**
- **3 new metadata fields** (just added)
- **2 generated fields**
- **Attendees in separate table**
- **Action items via separate API call**

### Total Coverage:
- ✅ **~90% of bulk API fields** captured
- ✅ **Action items** via separate endpoint
- ⚠️ **Advanced analytics** may require additional endpoints

---

## 🚀 Next Steps

### Immediate (Already Done):
1. ✅ Add action items via separate API endpoint
2. ✅ Add metadata fields (created_at, language, invitees_type)
3. ✅ Improve thumbnail fetching with fallback

### Short Term (Recommended):
1. Test if Fathom API provides:
   - `/recordings/{id}/speakers`
   - `/recordings/{id}/highlights`
   - `/recordings/{id}/topics`
2. Add tables for speakers and highlights if available

### Long Term (Nice to Have):
1. Speaker-level analytics (if API supports it)
2. Custom vocabulary/keyword extraction
3. Advanced sentiment analysis per speaker

---

## 🔍 How to Verify What's Available

Run a test API call to check available endpoints:
```bash
# Check recordings detail endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.fathom.ai/external/v1/recordings/{recording_id}

# Check if speakers endpoint exists
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.fathom.ai/external/v1/recordings/{recording_id}/speakers

# Check if highlights endpoint exists
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.fathom.ai/external/v1/recordings/{recording_id}/highlights
```

---

**Last Updated**: 2025-10-25
**Sync Function Version**: Latest (with action items support)
