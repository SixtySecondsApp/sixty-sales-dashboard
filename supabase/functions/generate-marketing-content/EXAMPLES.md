# Generate Marketing Content - Example Requests & Responses

## Example 1: Social Media Post

### Request
```json
{
  "meeting_id": "550e8400-e29b-41d4-a716-446655440000",
  "content_type": "social",
  "selected_topic_indices": [0, 2],
  "regenerate": false
}
```

### Response (Success - 200)
```json
{
  "success": true,
  "content": {
    "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "title": "Just learned why 67% of SaaS companies fail at customer retention",
    "content": "Just learned why 67% of SaaS companies fail at customer retention—and it's not what you think.\n\nIn our recent strategy session, we uncovered that [the biggest retention killer isn't poor product-market fit](https://app.fathom.video/meetings/550e8400-e29b-41d4-a716-446655440000?timestamp=245). It's inconsistent customer communication.\n\nHere's what worked for us:\n\n✅ Weekly check-ins (not monthly)\n✅ Proactive issue detection\n✅ Personalized onboarding paths\n\nThe result? [40% improvement in 90-day retention](https://app.fathom.video/meetings/550e8400-e29b-41d4-a716-446655440000?timestamp=892) and customers who actually become advocates.\n\nThe key insight: Retention isn't about having the perfect product. It's about being consistently present when customers need you most.\n\nWhat's your biggest retention challenge? Let me know in the comments.\n\n#CustomerSuccess #SaaS #CustomerRetention",
    "content_type": "social",
    "version": 1
  },
  "metadata": {
    "model_used": "claude-sonnet-4-5-20250929",
    "tokens_used": 4234,
    "cost_cents": 3,
    "cached": false,
    "topics_used": 2
  }
}
```

## Example 2: Blog Article

### Request
```json
{
  "meeting_id": "550e8400-e29b-41d4-a716-446655440000",
  "content_type": "blog",
  "selected_topic_indices": [0, 1, 2, 3],
  "regenerate": false
}
```

### Response (Success - 200)
```json
{
  "success": true,
  "content": {
    "id": "9f3b8e71-5c4a-4d21-8e9a-1a2b3c4d5e6f",
    "title": "How to Scale Customer Success Without Scaling Costs: 4 Proven Strategies",
    "content": "# How to Scale Customer Success Without Scaling Costs: 4 Proven Strategies\n\nEvery SaaS company faces the same challenge: as your customer base grows, how do you maintain high-touch customer success without proportionally increasing your team size and costs?\n\nIn our recent strategy session with customer success leaders from three rapidly scaling SaaS companies, we identified four proven strategies that are delivering measurable results. These aren't theoretical frameworks—they're battle-tested approaches that are working right now.\n\n## 1. Automate the Predictable, Personalize the Critical\n\nThe first breakthrough came when we [analyzed which customer touchpoints actually required human intervention](https://app.fathom.video/meetings/550e8400-e29b-41d4-a716-446655440000?timestamp=245).\n\nThe surprising finding: 60% of customer interactions followed predictable patterns that could be automated without sacrificing quality. This included:\n\n- Onboarding milestone emails\n- Product update notifications\n- Basic troubleshooting guides\n- Usage analytics reports\n\nBy automating these touchpoints, teams freed up 15-20 hours per week per CS representative—time that could be reinvested in high-value activities like strategic account planning and executive relationship building.\n\n**Key Implementation Tip**: Start with your top 10 most common customer questions. If 8 of them can be answered with existing documentation, that's your automation opportunity.\n\n## 2. Build Customer Health Scoring That Actually Predicts Churn\n\nMany companies have customer health scores. Few have ones that accurately predict problems before they become cancellations.\n\nWe discovered that [the most effective health scoring systems combined product usage data with communication patterns](https://app.fathom.video/meetings/550e8400-e29b-41d4-a716-446655440000?timestamp=567). Specifically:\n\n- **Login frequency** (obvious but essential)\n- **Feature adoption rate** (are they using advanced features?)\n- **Support ticket sentiment** (not just volume, but tone)\n- **Response time to outreach** (slowing responses = warning sign)\n\nOne company in our discussion implemented this multi-factor scoring and [reduced reactive support by 35% while improving retention by 18%](https://app.fathom.video/meetings/550e8400-e29b-41d4-a716-446655440000?timestamp=892).\n\n## 3. Create Tiered Success Programs\n\nNot all customers need the same level of attention. The mistake many companies make is trying to provide high-touch support to everyone.\n\nThe solution: [segment customers into clear success tiers based on ARR, strategic value, and growth potential](https://app.fathom.video/meetings/550e8400-e29b-41d4-a716-446655440000?timestamp=1203).\n\n**Tier 1 (Enterprise)**: Weekly check-ins, dedicated CSM, quarterly business reviews\n**Tier 2 (Mid-Market)**: Monthly check-ins, shared CSM (1:30 ratio), bi-annual reviews\n**Tier 3 (SMB)**: Automated touchpoints, community support, annual surveys\n\nThis approach allowed one company to serve 3x more customers with the same team size while actually improving satisfaction scores across all tiers.\n\n## 4. Leverage Your Customer Community\n\nThe most underutilized asset in customer success is your existing customer base.\n\nWe found that [building an active customer community reduced support load by 40%](https://app.fathom.video/meetings/550e8400-e29b-41d4-a716-446655440000?timestamp=1445) because customers were solving each other's problems.\n\nSuccessful community strategies included:\n\n- **Power User Programs**: Identify and empower your most engaged users\n- **Customer-Led Webinars**: Let successful customers share their strategies\n- **Peer-to-Peer Forums**: Facilitate connections between similar use cases\n- **Recognition & Rewards**: Acknowledge helpful community members\n\nOne company turned their top 20 power users into unofficial brand ambassadors who collectively handled 200+ support questions per month—entirely organically.\n\n## Measuring Success: The Metrics That Matter\n\nAs you implement these strategies, track these key metrics:\n\n- **CS Efficiency Ratio**: Revenue per CS team member\n- **Time to Value**: Days until customer reaches first success milestone\n- **Customer Effort Score**: How easy is it for customers to get help?\n- **Net Retention Rate**: Are you growing revenue within existing accounts?\n\nThe companies in our discussion averaged a 60% improvement in CS efficiency ratio within 6 months of implementing these strategies.\n\n## Conclusion: Start Small, Scale What Works\n\nYou don't need to implement everything at once. Start with the area causing the most pain:\n\n- Too many reactive support tickets? → Focus on health scoring\n- Onboarding taking too long? → Automate predictable touchpoints\n- Enterprise customers need more attention? → Implement tiered programs\n- Team overwhelmed with repetitive questions? → Build your community\n\nThe goal isn't to eliminate the human element from customer success. It's to use your team's time where it creates the most value—building relationships, solving complex problems, and driving strategic outcomes.\n\nWant to dive deeper into any of these strategies? [Watch our full strategy session](https://app.fathom.video/meetings/550e8400-e29b-41d4-a716-446655440000) for detailed implementation guides and real-world examples.\n\n**What's your biggest customer success scaling challenge?** Share your thoughts in the comments or reach out directly—I'd love to hear what's working (or not working) for you.",
    "content_type": "blog",
    "version": 1
  },
  "metadata": {
    "model_used": "claude-sonnet-4-5-20250929",
    "tokens_used": 8947,
    "cost_cents": 5,
    "cached": false,
    "topics_used": 4
  }
}
```

## Example 3: Video Script

### Request
```json
{
  "meeting_id": "550e8400-e29b-41d4-a716-446655440000",
  "content_type": "video",
  "selected_topic_indices": [1, 3],
  "regenerate": false
}
```

### Response (Success - 200)
```json
{
  "success": true,
  "content": {
    "id": "2a5c7e91-8f3d-4b2e-9c1a-7b6d5e4f3a2b",
    "title": "The Customer Success Secret That Increased Our Retention by 40%",
    "content": "# The Customer Success Secret That Increased Our Retention by 40%\n\n## HOOK (0:00-0:05)\n[VISUAL: Direct to camera, energetic]\n\n67% of SaaS companies are losing customers—and they don't even know why.\n\n## INTRO (0:05-0:25)\n[VISUAL: B-roll of team meeting, transition to screen share showing retention graph]\n\nHey everyone! Last week, I sat down with three customer success leaders who've cracked the code on retention. And what they told me completely changed how I think about customer success.\n\nToday, I'm sharing the **one strategy** that increased retention by 40% without hiring a single new CS rep.\n\n## MAIN CONTENT (0:25-2:00)\n[VISUAL: Split screen with you and key stats/points appearing]\n\n**Here's the problem most companies face:**\n\nThey're trying to give high-touch support to every single customer. [PAUSE] That doesn't scale.\n\nSo here's what actually works:\n\n**Strategy #1: Smart Automation**\n\nIn our session, we discovered that [60% of customer interactions are completely predictable](https://app.fathom.video/meetings/550e8400-e29b-41d4-a716-446655440000?timestamp=245).\n\n[VISUAL: Show example of automated email sequence]\n\nThink about it: onboarding emails, product updates, basic troubleshooting—these don't need a human every single time.\n\nBy automating the predictable stuff, you free up 15-20 hours **per week** per CS rep.\n\n[VISUAL: Transition to next point]\n\n**Strategy #2: Focus on What Matters**\n\nThis is where it gets interesting. [One company in our discussion implemented a simple health score](https://app.fathom.video/meetings/550e8400-e29b-41d4-a716-446655440000?timestamp=1203) that combined:\n- Login frequency\n- Feature adoption\n- Support ticket sentiment\n\n[VISUAL: Graphic showing health score dashboard]\n\nThe result? They **reduced reactive support by 35%** because they were catching problems before they became emergencies.\n\n**The Real Secret:**\n\n[PAUSE] [LEAN IN]\n\nIt's not about doing less for customers. It's about doing MORE of what actually moves the needle—and automating everything else.\n\n## CONCLUSION (2:00-2:30)\n[VISUAL: Back to you, direct to camera]\n\nLook, scaling customer success isn't about working harder. It's about working smarter.\n\nIf you want the complete strategy breakdown with all the implementation details, [check out the full discussion here](https://app.fathom.video/meetings/550e8400-e29b-41d4-a716-446655440000).\n\nAnd hey—if you found this helpful, hit that like button and subscribe for more practical SaaS strategies.\n\nWhat's your biggest customer success challenge? Drop it in the comments. I read every single one.\n\nSee you in the next video!\n\n---\n\n## SUGGESTED DESCRIPTION (for video platform):\n\nDiscover the customer success strategy that increased retention by 40% without hiring more CS reps. We break down smart automation, predictive health scoring, and where to focus your team's time for maximum impact. Watch the [full strategy session](https://app.fathom.video/meetings/550e8400-e29b-41d4-a716-446655440000) for detailed implementation guides.\n\n⏱️ TIMESTAMPS:\n0:00 - The Retention Problem\n0:25 - Strategy #1: Smart Automation  \n1:15 - Strategy #2: Predictive Health Scoring\n2:00 - Key Takeaways\n\n🔗 RESOURCES:\n[Full discussion with timestamps](https://app.fathom.video/meetings/550e8400-e29b-41d4-a716-446655440000)\n\n#CustomerSuccess #SaaS #CustomerRetention #Scaling",
    "content_type": "video",
    "version": 1
  },
  "metadata": {
    "model_used": "claude-sonnet-4-5-20250929",
    "tokens_used": 5678,
    "cost_cents": 3,
    "cached": false,
    "topics_used": 2
  }
}
```

## Example 4: Email Newsletter

### Request
```json
{
  "meeting_id": "550e8400-e29b-41d4-a716-446655440000",
  "content_type": "email",
  "selected_topic_indices": [0, 2, 3],
  "regenerate": false
}
```

### Response (Success - 200)
```json
{
  "success": true,
  "content": {
    "id": "4d8f2a91-6c5e-4b3d-9e2a-8c7b6d5f4e3a",
    "title": "The retention strategy that's working right now [40% improvement]",
    "content": "# The retention strategy that's working right now [40% improvement]\n\nHi there,\n\nQuick question: How much time does your CS team spend on tasks that could be automated?\n\nIf you're like most SaaS companies, the answer is probably \"way too much.\"\n\nLast week, I moderated a strategy session with three customer success leaders who've cracked this problem. And what they shared completely changed my perspective on scaling CS.\n\n## The Problem We're All Facing\n\nAs your customer base grows, you hit a wall. You can't hire CS reps fast enough to maintain the high-touch experience that made customers fall in love with you in the first place.\n\nSound familiar?\n\nHere's what's working right now:\n\n## Three Strategies That Actually Move the Needle\n\n**1. Automate 60% of Customer Touchpoints**\n\nOne company in our discussion [analyzed every customer interaction over 90 days](https://app.fathom.video/meetings/550e8400-e29b-41d4-a716-446655440000?timestamp=245). They found that 60% followed predictable patterns.\n\nBy automating just these predictable touchpoints, they freed up **15-20 hours per week** per CS rep. That's nearly half a workweek that could be reinvested in strategic account planning and relationship building.\n\n**2. Build Health Scores That Actually Predict Problems**\n\nMost health scores are too simple. Login frequency isn't enough.\n\nThe breakthrough: [combining product usage with communication patterns](https://app.fathom.video/meetings/550e8400-e29b-41d4-a716-446655440000?timestamp=892). Specifically:\n- Login frequency + feature adoption\n- Support ticket sentiment (not just volume)\n- Response time to your outreach\n\nResult: 35% reduction in reactive support and 18% improvement in retention.\n\n**3. Segment Your Success Programs**\n\nNot all customers need the same attention. [Tier your customers based on ARR and strategic value](https://app.fathom.video/meetings/550e8400-e29b-41d4-a716-446655440000?timestamp=1203), then design appropriate touch patterns:\n\n- **Enterprise**: Weekly check-ins, dedicated CSM\n- **Mid-Market**: Monthly check-ins, shared CSM (1:30 ratio)  \n- **SMB**: Automated touchpoints, community support\n\nOne company used this approach to serve **3x more customers** with the same team size while improving satisfaction across all tiers.\n\n## The Key Insight\n\nThis isn't about doing less for customers. It's about focusing your team's time where it creates the most value—solving complex problems, building relationships, and driving strategic outcomes.\n\nThe companies implementing these strategies averaged a **60% improvement in CS efficiency** within 6 months.\n\n## What to Do Next\n\nStart with one area:\n\n1. **Too many reactive tickets?** → Implement predictive health scoring\n2. **Onboarding taking forever?** → Automate your predictable touchpoints  \n3. **Enterprise customers need more attention?** → Build tiered programs\n\n[Watch the full strategy session](https://app.fathom.video/meetings/550e8400-e29b-41d4-a716-446655440000) for detailed implementation guides and real examples from each company.\n\nReply and let me know which strategy you're going to try first—I read every response.\n\nTalk soon,\n[Your Name]\n\n---\nP.S. If you found this valuable, forward it to your CS leader. They'll thank you.",
    "content_type": "email",
    "version": 1
  },
  "metadata": {
    "model_used": "claude-sonnet-4-5-20250929",
    "tokens_used": 6234,
    "cost_cents": 4,
    "cached": false,
    "topics_used": 3
  }
}
```

## Example 5: Cached Response

### Request
```json
{
  "meeting_id": "550e8400-e29b-41d4-a716-446655440000",
  "content_type": "social",
  "selected_topic_indices": [0, 2]
}
```

### Response (Success - 200, Cached)
```json
{
  "success": true,
  "content": {
    "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "title": "Just learned why 67% of SaaS companies fail at customer retention",
    "content": "[Same content as Example 1]",
    "content_type": "social",
    "version": 1
  },
  "metadata": {
    "model_used": "claude-sonnet-4-5-20250929",
    "tokens_used": 4234,
    "cost_cents": 3,
    "cached": true,  // <-- Note: cached=true
    "topics_used": 2
  }
}
```

**Response Time**: ~50ms (vs ~4000ms for uncached)

## Example 6: Regenerate (New Version)

### Request
```json
{
  "meeting_id": "550e8400-e29b-41d4-a716-446655440000",
  "content_type": "social",
  "selected_topic_indices": [0, 2],
  "regenerate": true  // <-- Force new generation
}
```

### Response (Success - 200)
```json
{
  "success": true,
  "content": {
    "id": "9a1b2c3d-4e5f-6789-0abc-def123456789",
    "title": "Why your customer retention strategy is failing (and how to fix it)",
    "content": "Why your customer retention strategy is failing (and how to fix it).\n\nMost SaaS companies think retention is about product features. They're wrong.\n\nIn our latest strategy deep-dive, we discovered [the real retention killer: inconsistent communication](https://app.fathom.video/meetings/550e8400-e29b-41d4-a716-446655440000?timestamp=245).\n\nHere's what actually works:\n\n🎯 Weekly (not monthly) check-ins\n🎯 Proactive outreach before problems escalate\n🎯 Personalized onboarding journeys\n\nOne company implemented this approach and saw [a 40% boost in 90-day retention](https://app.fathom.video/meetings/550e8400-e29b-41d4-a716-446655440000?timestamp=892).\n\nThe insight that changed everything: Your customers don't need a perfect product. They need to know you're there when it matters.\n\nWhat's working for you? Drop your retention wins in the comments.\n\n#CustomerRetention #SaaS #CustomerSuccess",
    "content_type": "social",
    "version": 2  // <-- Version incremented
  },
  "metadata": {
    "model_used": "claude-sonnet-4-5-20250929",
    "tokens_used": 4156,
    "cost_cents": 3,
    "cached": false,
    "topics_used": 2
  }
}
```

## Example 7: Error - Invalid Content Type

### Request
```json
{
  "meeting_id": "550e8400-e29b-41d4-a716-446655440000",
  "content_type": "podcast",  // <-- Invalid type
  "selected_topic_indices": [0]
}
```

### Response (Error - 400)
```json
{
  "success": false,
  "error": "Invalid content_type: must be one of social, blog, video, email"
}
```

## Example 8: Error - Topics Not Extracted Yet

### Request
```json
{
  "meeting_id": "550e8400-e29b-41d4-a716-446655440000",
  "content_type": "social",
  "selected_topic_indices": [0, 1]
}
```

### Response (Error - 422)
```json
{
  "success": false,
  "error": "No topics extracted for this meeting yet",
  "details": "Please run topic extraction first"
}
```

## Example 9: Error - Invalid Topic Indices

### Request
```json
{
  "meeting_id": "550e8400-e29b-41d4-a716-446655440000",
  "content_type": "social",
  "selected_topic_indices": [0, 2, 10]  // <-- Index 10 doesn't exist (only 8 topics)
}
```

### Response (Error - 400)
```json
{
  "success": false,
  "error": "Invalid topic indices: 10 (max index: 7)"
}
```

## Example 10: Error - No Transcript

### Request
```json
{
  "meeting_id": "550e8400-e29b-41d4-a716-446655440000",
  "content_type": "blog",
  "selected_topic_indices": [0, 1, 2]
}
```

### Response (Error - 422)
```json
{
  "success": false,
  "error": "This meeting does not have a transcript yet",
  "details": "Please wait for the transcript to be processed"
}
```

## Testing with curl

### Basic Test
```bash
curl -X POST https://your-project.supabase.co/functions/v1/generate-marketing-content \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "meeting_id": "550e8400-e29b-41d4-a716-446655440000",
    "content_type": "social",
    "selected_topic_indices": [0, 2]
  }'
```

### Test with Regeneration
```bash
curl -X POST https://your-project.supabase.co/functions/v1/generate-marketing-content \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "meeting_id": "550e8400-e29b-41d4-a716-446655440000",
    "content_type": "blog",
    "selected_topic_indices": [0, 1, 2, 3],
    "regenerate": true
  }'
```

## Integration Example (TypeScript)

```typescript
interface GenerateContentParams {
  meetingId: string
  contentType: 'social' | 'blog' | 'video' | 'email'
  selectedTopicIndices: number[]
  regenerate?: boolean
}

async function generateMarketingContent(
  params: GenerateContentParams,
  authToken: string
) {
  const response = await fetch(
    'https://your-project.supabase.co/functions/v1/generate-marketing-content',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        meeting_id: params.meetingId,
        content_type: params.contentType,
        selected_topic_indices: params.selectedTopicIndices,
        regenerate: params.regenerate,
      }),
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to generate content')
  }

  return await response.json()
}

// Usage
const result = await generateMarketingContent(
  {
    meetingId: '550e8400-e29b-41d4-a716-446655440000',
    contentType: 'social',
    selectedTopicIndices: [0, 2],
  },
  userAuthToken
)

console.log('Generated content:', result.content.content)
console.log('Cost:', result.metadata.cost_cents, 'cents')
```
