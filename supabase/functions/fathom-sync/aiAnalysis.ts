/**
 * AI Analysis Module for Fathom Transcripts
 * Uses Claude Haiku 4.5 to extract action items, analyze talk time, and determine sentiment
 */

interface ActionItem {
  title: string
  assignedTo: string | null
  assignedToEmail: string | null
  deadline: string | null // ISO date string
  // Normalized category aligned with tasks UI
  category: 'call' | 'email' | 'meeting' | 'follow_up' | 'proposal' | 'demo' | 'general'
  priority: 'high' | 'medium' | 'low'
  confidence: number
}

interface TalkTimeAnalysis {
  repPct: number
  customerPct: number
  assessment: string
}

interface SentimentAnalysis {
  score: number // -1.0 to 1.0
  reasoning: string
  keyMoments: string[]
}

export interface TranscriptAnalysis {
  actionItems: ActionItem[]
  talkTime: TalkTimeAnalysis
  sentiment: SentimentAnalysis
}

interface Meeting {
  id: string
  title: string
  meeting_start: string
  owner_email: string | null
}

/**
 * Analyze transcript using Claude Haiku 4.5
 */
export async function analyzeTranscriptWithClaude(
  transcript: string,
  meeting: Meeting
): Promise<TranscriptAnalysis> {
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured')
  }

  const model = Deno.env.get('CLAUDE_MODEL') || 'claude-haiku-4-5-20251001'

  console.log(`🤖 Analyzing transcript with ${model} for meeting: ${meeting.title}`)

  const prompt = buildAnalysisPrompt(transcript, meeting)

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Claude API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const content = data.content[0].text

    console.log(`✅ Claude analysis complete (${data.usage.input_tokens} input, ${data.usage.output_tokens} output tokens)`)

    // Parse JSON response
    const analysis = parseClaudeResponse(content)

    return analysis
  } catch (error) {
    console.error('❌ Error calling Claude API:', error)
    throw error
  }
}

/**
 * Build the analysis prompt for Claude
 */
function buildAnalysisPrompt(transcript: string, meeting: Meeting): string {
  const meetingDate = new Date(meeting.meeting_start).toISOString().split('T')[0]

  return `Analyze this sales call transcript and extract structured information.

MEETING CONTEXT:
- Title: ${meeting.title}
- Date: ${meetingDate}
- Host: ${meeting.owner_email || 'Unknown'}

TRANSCRIPT:
${transcript}

Please analyze the transcript and provide:

1. ACTION ITEMS (ONLY concrete, agreed, assignable next steps):
   Extract action items that are clearly agreed upon and require action. Exclude ideas, suggestions, opinions, or vague topics.

   IMPORTANT: Look for BOTH explicit and implicit action items, but include ONLY if they represent a concrete next step:
   - Explicit: "I'll send you the proposal by Friday"
   - Implicit: "We need to review the contract" (creates action for someone)
   - Commitments: "We'll get back to you with those numbers"
   - Questions to follow up on: "Let me check with the team and circle back"
   - Next steps agreed upon: "Let's schedule a follow-up for next week"

   Extract action items for BOTH parties:
   - Sales Rep tasks: Things the rep/your team needs to do
   - Prospect/Customer tasks: Things the customer agreed to do

   Common action items to look for:
   - Send information (proposal, pricing, case studies, documentation)
   - Schedule meetings (demos, follow-ups, stakeholder calls)
   - Internal tasks (check with team, get approval, review documents)
   - Customer tasks (review materials, provide information, make decisions)
   - Technical items (set up integrations, provide access, configure)

   For each action item:
   - Title: Clear, specific description of what needs to be done
   - Assigned to: Person's name who should do it (sales rep name, customer name, or role like "Sales Team" or "Customer")
   - Assigned to email: Email address if mentioned, otherwise null
   - Deadline: Date when it's due (relative to ${meetingDate}). Parse phrases like:
     * "tomorrow" = 1 day from meeting date
     * "next week" = 7 days from meeting date
     * "end of week" = nearest Friday from meeting date
     * "by Friday" = nearest Friday from meeting date
     * "in 2 days" = 2 days from meeting date
     * If no deadline mentioned, use null
   - Category: Map to ONE of: call, email, meeting, follow_up, proposal, demo, general (use general for anything else)
   - Priority: Assess as high (urgent/time-sensitive), medium (important but flexible), or low (nice to have)
   - Confidence: How confident are you this is a real action item (0.0 to 1.0)
     * 0.9-1.0: Explicit commitment ("I will...")
     * 0.7-0.9: Strong indication ("We should...")
     * 0.5-0.7: Implied action ("That would be helpful...")
     * <0.5: Unclear or speculative

2. TALK TIME ANALYSIS:
   Analyze who spoke more during the call:
   - Rep percentage: Estimated % of time sales rep(s) spoke
   - Customer percentage: Estimated % of time customer(s) spoke
   - Assessment: Brief evaluation (e.g., "Balanced conversation", "Rep talked too much", "Good listening")

3. SENTIMENT ANALYSIS:
   Evaluate the overall tone and sentiment of the call:
   - Score: Overall sentiment from -1.0 (very negative) to 1.0 (very positive)
   - Reasoning: Brief explanation of why you gave this score
   - Key moments: List 2-3 significant positive or negative moments

Return ONLY valid JSON in this exact format and include ONLY 3-8 of the most important action items that meet the criteria:
{
  "actionItems": [
    {
      "title": "Send detailed pricing proposal with enterprise tier options",
      "assignedTo": "John Smith",
      "assignedToEmail": "john@company.com",
      "deadline": "2025-11-05",
      "category": "proposal",
      "priority": "high",
      "confidence": 0.95
    },
    {
      "title": "Schedule technical demo with engineering team",
      "assignedTo": "Sales Team",
      "assignedToEmail": null,
      "deadline": "2025-11-08",
      "category": "demo",
      "priority": "high",
      "confidence": 0.9
    },
    {
      "title": "Review proposal and provide feedback to team",
      "assignedTo": "Sarah Johnson",
      "assignedToEmail": "sarah@prospect.com",
      "deadline": "2025-11-10",
      "category": "follow_up",
      "priority": "medium",
      "confidence": 0.85
    },
    {
      "title": "Get budget approval from finance",
      "assignedTo": "Customer",
      "assignedToEmail": null,
      "deadline": null,
      "category": "general",
      "priority": "high",
      "confidence": 0.8
    }
  ],
  "talkTime": {
    "repPct": 45.5,
    "customerPct": 54.5,
    "assessment": "Well-balanced conversation with good listening"
  },
  "sentiment": {
    "score": 0.75,
    "reasoning": "Positive and engaged conversation with strong interest",
    "keyMoments": [
      "Customer expressed enthusiasm about the product",
      "Pricing concerns were addressed satisfactorily",
      "Clear next steps established"
    ]
  }
}

IMPORTANT:
- Return ONLY the JSON, no other text
- Use null for missing values
- Ensure all percentages sum to 100
- Include BOTH sales rep tasks AND customer/prospect tasks
- Exclude ideas or vague statements (e.g., "it might be good to...", "we could consider...")
- Only include items with clear ownership and a concrete verb (send, schedule, review, provide, decide, sign, integrate, configure, follow up)
- Prefer items with an explicit or reasonably inferred deadline
- Mark confidence appropriately; avoid items below 0.7 confidence
- If truly no action items found, return empty array (but this should be rare for sales calls)`
}

/**
 * Parse and validate Claude's JSON response
 */
function parseClaudeResponse(content: string): TranscriptAnalysis {
  try {
    // Extract JSON from markdown code blocks if present
    let jsonText = content.trim()
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '')
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '').replace(/```\n?$/g, '')
    }

    const parsed = JSON.parse(jsonText)

    // Validate structure
    if (!parsed.actionItems || !Array.isArray(parsed.actionItems)) {
      throw new Error('Missing or invalid actionItems array')
    }
    if (!parsed.talkTime || typeof parsed.talkTime !== 'object') {
      throw new Error('Missing or invalid talkTime object')
    }
    if (!parsed.sentiment || typeof parsed.sentiment !== 'object') {
      throw new Error('Missing or invalid sentiment object')
    }

    // Validate and normalize action items
    const actionItems: ActionItem[] = parsed.actionItems.map((item: any) => ({
      title: String(item.title || 'Untitled action item'),
      assignedTo: item.assignedTo || null,
      assignedToEmail: item.assignedToEmail || null,
      deadline: item.deadline || null,
      category: validateCategory(item.category),
      priority: validatePriority(item.priority),
      confidence: Math.min(Math.max(Number(item.confidence || 0.5), 0), 1),
    }))

    // Validate and normalize talk time
    const talkTime: TalkTimeAnalysis = {
      repPct: Math.min(Math.max(Number(parsed.talkTime.repPct || 50), 0), 100),
      customerPct: Math.min(Math.max(Number(parsed.talkTime.customerPct || 50), 0), 100),
      assessment: String(parsed.talkTime.assessment || 'Unable to assess'),
    }

    // Validate and normalize sentiment
    const sentiment: SentimentAnalysis = {
      score: Math.min(Math.max(Number(parsed.sentiment.score || 0), -1), 1),
      reasoning: String(parsed.sentiment.reasoning || 'No reasoning provided'),
      keyMoments: Array.isArray(parsed.sentiment.keyMoments)
        ? parsed.sentiment.keyMoments.map(String).slice(0, 5)
        : [],
    }

    return {
      actionItems,
      talkTime,
      sentiment,
    }
  } catch (error) {
    console.error('❌ Error parsing Claude response:', error)
    console.error('Raw response:', content)
    throw new Error(`Failed to parse Claude response: ${error.message}`)
  }
}

/**
 * Validate and normalize category
 */
function validateCategory(
  category: string
): 'follow_up' | 'demo' | 'proposal' | 'contract' | 'technical' | 'other' {
  const validCategories = ['follow_up', 'demo', 'proposal', 'contract', 'technical', 'other']
  const normalized = String(category || 'other').toLowerCase().replace(/[- ]/g, '_')

  if (validCategories.includes(normalized)) {
    return normalized as any
  }

  return 'other'
}

/**
 * Validate and normalize priority
 */
function validatePriority(priority: string): 'high' | 'medium' | 'low' {
  const normalized = String(priority || 'medium').toLowerCase()

  if (['high', 'medium', 'low'].includes(normalized)) {
    return normalized as any
  }

  return 'medium'
}

/**
 * Deduplicate action items against existing Fathom action items
 */
export function deduplicateActionItems(
  aiItems: ActionItem[],
  fathomItems: any[]
): ActionItem[] {
  if (!fathomItems || fathomItems.length === 0) {
    return aiItems
  }

  const uniqueAIItems: ActionItem[] = []

  for (const aiItem of aiItems) {
    const isDuplicate = fathomItems.some(fathomItem => {
      return isSimilarActionItem(aiItem.title, fathomItem.title || fathomItem.description)
    })

    if (!isDuplicate) {
      uniqueAIItems.push(aiItem)
    } else {
      console.log(`🔄 Skipping duplicate AI action item: "${aiItem.title}"`)
    }
  }

  console.log(`✅ Found ${uniqueAIItems.length} unique AI action items (${aiItems.length - uniqueAIItems.length} duplicates removed)`)

  return uniqueAIItems
}

/**
 * Check if two action items are similar (fuzzy matching)
 */
function isSimilarActionItem(text1: string, text2: string): boolean {
  if (!text1 || !text2) return false

  const normalize = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .trim()

  const norm1 = normalize(text1)
  const norm2 = normalize(text2)

  // Exact match
  if (norm1 === norm2) return true

  // One contains the other
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    return true
  }

  // Calculate similarity ratio (simple word overlap)
  const words1 = new Set(norm1.split(/\s+/))
  const words2 = new Set(norm2.split(/\s+/))
  const intersection = new Set([...words1].filter(x => words2.has(x)))
  const union = new Set([...words1, ...words2])

  const similarity = intersection.size / union.size

  // Consider similar if >60% word overlap
  return similarity > 0.6
}
