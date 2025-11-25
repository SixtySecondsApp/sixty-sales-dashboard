/**
 * Email AI Analysis Service
 * 
 * Uses Claude Haiku 4.5 to analyze sales emails for CRM health tracking.
 * Extracts sentiment, topics, action items, urgency, and response requirements.
 */

export interface EmailAnalysis {
  sentiment_score: number; // -1 to 1
  key_topics: string[];
  action_items: string[];
  urgency: 'low' | 'medium' | 'high';
  response_required: boolean;
}

/**
 * Analyze email with Claude Haiku 4.5
 * 
 * @param emailSubject - Email subject line
 * @param emailBody - Email body content
 * @returns Analysis results including sentiment, topics, action items, urgency, and response requirement
 */
export async function analyzeEmailWithClaude(
  emailSubject: string,
  emailBody: string
): Promise<EmailAnalysis> {
  const anthropicApiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  
  if (!anthropicApiKey) {
    // Fallback: try to get from edge function if not available in client
    // For edge functions, this will be passed as environment variable
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const model = 'claude-haiku-4-5-20251001';
  const prompt = buildAnalysisPrompt(emailSubject, emailBody);

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
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.content[0].text;
    
    // Parse JSON response
    const analysis = parseClaudeResponse(content);
    
    return analysis;
  } catch (error) {
    console.error('Error analyzing email with Claude:', error);
    throw error;
  }
}

/**
 * Build the analysis prompt for Claude Haiku 4.5
 */
function buildAnalysisPrompt(subject: string, body: string): string {
  return `Analyze this sales email for CRM health tracking.

Subject: ${subject}
Body: ${body}

Extract:
1. Sentiment (-1 to 1): How positive/negative is the tone? Consider politeness, enthusiasm, frustration, urgency.
2. Key topics (max 3): Main discussion points or themes
3. Action items: Any tasks or follow-ups mentioned (extract as array of strings)
4. Urgency (low/medium/high): How urgent is this communication? Consider deadlines, time-sensitive requests, or explicit urgency indicators.
5. Response required (yes/no): Does this need a response? Consider questions asked, requests made, or calls to action.

Return ONLY valid JSON in this exact format:
{
  "sentiment_score": 0.5,
  "key_topics": ["topic1", "topic2", "topic3"],
  "action_items": ["action1", "action2"],
  "urgency": "medium",
  "response_required": true
}

Important:
- sentiment_score must be between -1 and 1
- key_topics must be an array of max 3 strings
- action_items must be an array of strings (can be empty)
- urgency must be exactly one of: "low", "medium", "high"
- response_required must be a boolean`;
}

/**
 * Parse Claude's JSON response
 */
function parseClaudeResponse(content: string): EmailAnalysis {
  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Claude response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate and normalize response
    return {
      sentiment_score: Math.max(-1, Math.min(1, parsed.sentiment_score || 0)),
      key_topics: Array.isArray(parsed.key_topics) 
        ? parsed.key_topics.slice(0, 3).filter((t: any) => typeof t === 'string')
        : [],
      action_items: Array.isArray(parsed.action_items)
        ? parsed.action_items.filter((a: any) => typeof a === 'string')
        : [],
      urgency: ['low', 'medium', 'high'].includes(parsed.urgency) 
        ? parsed.urgency 
        : 'medium',
      response_required: Boolean(parsed.response_required),
    };
  } catch (error) {
    console.error('Error parsing Claude response:', error);
    // Return default analysis on parse error
    return {
      sentiment_score: 0,
      key_topics: [],
      action_items: [],
      urgency: 'medium',
      response_required: false,
    };
  }
}




