# Relationship Health Monitor - User Guide

## 📖 Overview

The **Relationship Health Monitor** is an AI-powered early warning system that continuously tracks the health of your relationships with contacts and companies. It detects patterns of relationship decay before opportunities are lost and provides personalized "permission to close" intervention tactics.

---

## 🎯 Key Features

### 1. **Multi-Signal Health Scoring**
Every contact and company relationship receives a health score (0-100) based on:

- **Communication Frequency (25%)** - How often you interact
- **Response Behavior (30%)** - Response times and engagement
- **Engagement Quality (20%)** - Meeting attendance, email opens, link clicks
- **Sentiment (15%)** - Tone and sentiment of communications
- **Meeting Patterns (10%)** - Meeting attendance and cancellations

**Health Status Levels:**
- 🟢 **Healthy** (70-100): Strong, engaged relationship
- 🟡 **At Risk** (40-69): Showing signs of disengagement
- 🟠 **Critical** (20-39): Significant relationship decay
- 🔴 **Ghost** (0-19): Relationship has gone cold

### 2. **Ghost Detection System**
Identifies 7 specific behavioral signals that predict prospect ghosting:

1. **Email No Response** - Emails sent but no reply received
2. **Response Time Increased** - Taking longer to respond than baseline
3. **Email Opens Declined** - Email open rates dropping
4. **Meeting Cancelled** - Cancelled meetings without rescheduling
5. **Meeting Rescheduled Repeatedly** - Serial meeting postponement
6. **Sentiment Declining** - Negative shift in communication tone
7. **Engagement Pattern Break** - Communication frequency dropped below baseline

Each signal has a severity level: **Low**, **Medium**, **High**, or **Critical**

### 3. **"Permission to Close" Interventions**
Psychology-backed intervention templates that remove pressure and force decision points:

**Template Types:**
- **Permission to Close** - "Is it safe to assume you've moved on?"
- **Value Add** - Re-engagement through value delivery
- **Pattern Interrupt** - Break communication patterns
- **Soft Check-in** - Low-pressure status check
- **Channel Switch** - Try different communication channels

**Built-in A/B Testing:**
- Track template performance (recovery rate, response rate)
- Test multiple variants of each template type
- Automatic template selection based on performance

### 4. **Personalized Template System**
Templates automatically personalize using:
- Contact/company name
- Last meaningful interaction details
- Specific value propositions from past conversations
- Deal value and stage information
- Meeting transcript insights

---

## 🚀 Getting Started

### Accessing the Dashboard

**Option 1: Main Dashboard**
Navigate to: `/crm/relationship-health`

**Option 2: Contact Profiles**
- Open any contact record
- View the **Relationship Health** widget in the right sidebar
- Click "Open Relationship Dashboard" for full details

**Option 3: Company Profiles**
- Open any company profile
- View the **Relationship Health** widget in the right sidebar
- Click "Open Relationship Dashboard" for full details

---

## 📊 Using the Dashboard

### Overview Tab

**Summary Statistics:**
- Total relationships tracked
- Count by health status (Healthy, At Risk, Critical, Ghost)
- Average health score across all relationships

**Intervention Performance Metrics:**
- Total interventions sent
- Response rate (% who replied)
- Recovery rate (% who re-engaged)
- Replied count

**At-Risk Alerts:**
Shows urgent relationship risks requiring immediate attention with one-click intervention sending.

**Search & Filter:**
- Search by contact/company name
- Sort by health score, risk level, or recency
- Filter to show only at-risk relationships

### At Risk Tab

Focused view showing only relationships requiring attention:
- Critical and ghost status relationships displayed first
- Ghost signal count and severity for each
- One-click intervention deployment
- Snooze or mark as handled

### Templates Tab

**Template Library Management:**
- Browse templates by type
- View performance metrics (recovery rate, response rate, times sent)
- Create custom templates
- Edit existing templates
- Manage A/B test variants
- Preview templates with sample personalization
- Archive unused templates

**Sorting Options:**
- Best Performance - Highest recovery rates first
- Most Recent - Newest templates first
- Name (A-Z) - Alphabetical order

### Analytics Tab
*(Coming Soon)*
- Historical health score trends
- Intervention success rates over time
- Ghost signal patterns
- Template performance comparisons

---

## 💡 Best Practices

### 1. **Monitor Regularly**
- Check the dashboard weekly for new at-risk relationships
- Set up alerts for critical status changes
- Review ghost signals as they're detected

### 2. **Act Quickly**
- Send interventions within 24 hours of ghost detection
- Use the recommended template for best results
- Personalize the template before sending

### 3. **Track Performance**
- Monitor which templates work best for your audience
- Create A/B test variants to optimize messaging
- Archive low-performing templates

### 4. **Update Baselines**
- The system learns normal communication patterns over time
- Baseline metrics become more accurate with more data
- Early detection improves as baselines establish

### 5. **Use Context**
- Review the relationship timeline before intervening
- Check recent ghost signals for specific issues
- Reference meeting transcripts for personalization

---

## 🔧 Sending an Intervention

### Step-by-Step Process:

**1. Detection**
- Review ghost signals detected
- Check health score and status
- View days since last contact

**2. Template Selection**
- System recommends best template based on:
  - Ghost risk severity
  - Health score level
  - Historical template performance
  - Relationship context
- Browse alternative templates
- Preview template with sample data

**3. Personalization**
- Review auto-generated personalization fields
- Edit template body if needed
- Add custom subject line
- Verify all placeholders filled correctly

**4. Send & Track**
- Send intervention via email
- System automatically creates follow-up task (3 days)
- Track response in intervention history
- Update relationship health score based on response

### Quick Intervention (Profile Widget):

**From Contact/Company Profile:**
1. See ghost risk warning in Relationship Health widget
2. Click "Send Intervention"
3. Select template (or use recommended)
4. Send with one click
5. Return to profile to continue work

---

## 📈 Understanding Health Metrics

### Communication Frequency Score
- Compares current contact frequency to baseline
- Score drops when contact becomes less frequent than normal
- Baseline established from first 30 days of interaction

### Response Behavior Score
- **Most important for ghost detection** (30% weight)
- Tracks response times vs. baseline
- Monitors email open rates
- Detects unread emails and non-responses

### Engagement Quality Score
- Meeting attendance rate
- Email link click-through rate
- Proposal view rates
- Overall engagement trends

### Sentiment Score
- Tone analysis of communications
- Positive vs. negative language patterns
- Enthusiasm level changes
- Warning sign detection

### Meeting Pattern Score
- Meeting attendance consistency
- Cancellation frequency
- Rescheduling patterns
- Calendar acceptance rate

---

## 🎨 Widget Integration

### Contact Profile Widget

Shows:
- Overall health score and status badge
- 4 key signal scores (communication, response, engagement, sentiment)
- Ghost risk warnings when detected
- Days since last contact vs. expected frequency
- Quick intervention button
- Link to full dashboard

### Company Profile Widget

Shows:
- Company-level health aggregated across contacts
- Active deal health scores
- Ghost risk alerts for the company relationship
- Intervention history
- Link to full dashboard

---

## 📝 Template Personalization Fields

### Available Fields:

- `{{first_name}}` - Contact first name
- `{{last_name}}` - Contact last name
- `{{company_name}}` - Company name
- `{{last_meaningful_interaction}}` - Description of last significant touchpoint
- `{{personalized_assumption}}` - Context-aware assumption (e.g., "you've moved forward with another solution")
- `{{specific_value_point}}` - Referenced value from past conversations
- `{{deal_value}}` - Current deal value
- `{{days_silent}}` - Number of days since last contact
- `{{meeting_reference}}` - Reference to specific meeting
- `{{proposal_reference}}` - Reference to sent proposal

### Example Template:

```
Hey {{first_name}},

I haven't heard back from you since {{last_meaningful_interaction}}, so I'm going to assume {{personalized_assumption}}.

If that's the case, no problem at all - I just wanted to close the loop on our conversation about {{specific_value_point}}.

If I'm wrong and the timing just isn't right, let me know and I'll check back in a few months.

Best,
[Your Name]
```

---

## 🔄 Automation & Workflows

### Automatic Health Scoring
- Health scores update daily
- Baseline metrics recalculated weekly
- Ghost signals detected in real-time
- Alerts generated when status changes to critical/ghost

### Auto-Generated Tasks
- 3-day follow-up task created after intervention sent
- Reminders when ghost signals accumulate
- Weekly digest of at-risk relationships

### Integration Points
- Email tracking integration (opens, clicks, replies)
- Calendar integration (meetings, cancellations)
- Deal stage integration (proposal sent, deal won/lost)
- Communication event tracking (all interactions logged)

---

## 🆘 Troubleshooting

### "No health data available"
**Cause:** Contact/company doesn't have enough interaction history
**Solution:** Health scoring requires at least 3 communication events. Continue normal engagement and check back in a few days.

### "Health score seems inaccurate"
**Cause:** Baseline not yet established
**Solution:** System requires 30 days to establish accurate baselines. Early scores may fluctuate. Accuracy improves over time.

### "Intervention template won't send"
**Cause:** Missing required personalization fields
**Solution:** Check that all `{{field}}` placeholders have values. Add missing information to contact/company record.

### "Ghost signals showing for active contact"
**Cause:** Communication happening outside tracked channels
**Solution:** Log manual activities for phone calls, in-person meetings, or external communications.

---

## 🎓 Advanced Features

### A/B Template Testing

**Creating Variants:**
1. Navigate to Templates tab
2. Select template to test
3. Click "Create Variant"
4. Edit subject line and/or body
5. Mark one as "Control Variant"
6. Send both variants to different contacts
7. Compare performance metrics

**Analyzing Results:**
- Review recovery rate % for each variant
- Check response rate %
- Monitor times sent and times replied
- Promote winning variant to default

### Custom Template Creation

**Best Practices:**
- Keep subject lines under 50 characters
- Use personalization fields strategically
- Lead with value, not apology
- Create clear exit path ("if I'm wrong...")
- Include specific next step
- Test multiple variants

### Bulk Intervention Sending
*(Coming in future update)*
- Select multiple at-risk relationships
- Apply same template to batch
- Customize each before sending
- Track batch performance

---

## 📞 Support & Feedback

### Getting Help
- Review this user guide for common questions
- Check IMPLEMENTATION_PLAN.md for technical details
- Contact your system administrator for access issues

### Feature Requests
- Submit via your organization's feedback channel
- Describe use case and expected behavior
- Include screenshots if applicable

---

## 🔮 Roadmap

**Planned Enhancements:**

### Phase 5: AI Integration
- Anthropic Claude-powered template personalization
- AI-generated response suggestions
- Intelligent template selection
- Sentiment analysis improvements

### Phase 6: Advanced Analytics
- Historical health score trends
- Predictive ghosting alerts (before signals appear)
- Deal correlation analysis
- ROI tracking per intervention

### Phase 7: Automation
- Automatic intervention sending (with approval)
- Smart scheduling based on contact timezone
- Multi-channel intervention (email, LinkedIn, SMS)
- CRM workflow integration

---

**Version:** 1.0
**Last Updated:** November 22, 2025
**For Questions:** Contact your CRM administrator
