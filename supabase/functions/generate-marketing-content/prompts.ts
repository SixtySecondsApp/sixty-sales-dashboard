/**
 * Content Type Prompts
 *
 * AI prompts optimized for each marketing content type with specific requirements
 * for tone, structure, and timestamp link integration.
 */

interface PromptOptions {
  meetingTitle: string
  meetingDate: string
  topics: Array<{
    title: string
    description: string
    timestamp_seconds: number
  }>
  transcriptExcerpt: string
  fathomBaseUrl: string
}

/**
 * Build prompt for social media posts (LinkedIn/Twitter)
 * Target: 200-300 words, conversational, engaging
 */
export function buildSocialPrompt(options: PromptOptions): string {
  const { meetingTitle, meetingDate, topics, transcriptExcerpt, fathomBaseUrl } = options

  const topicsList = topics
    .map(
      (topic, i) =>
        `${i + 1}. ${topic.title}\n   ${topic.description}\n   [Timestamp: ${topic.timestamp_seconds}s]`
    )
    .join('\n\n')

  return `You are a professional social media content writer creating an engaging post from a business meeting.

MEETING CONTEXT:
- Title: ${meetingTitle}
- Date: ${meetingDate}

SELECTED TOPICS:
${topicsList}

TRANSCRIPT EXCERPT:
${transcriptExcerpt}

TASK:
Create a compelling social media post (LinkedIn/Twitter) that:
- Word count: 200-300 words
- Tone: Conversational, engaging, authentic
- Structure: Hook opening → Key insight → Call to action
- Include 2-3 relevant hashtags at the end
- Make it shareable and thought-provoking

IMPORTANT - TIMESTAMP LINKS:
- Reference specific insights from the transcript
- Include inline timestamp links using this exact format: [insight or quote](${fathomBaseUrl}?timestamp=X)
- Replace X with the actual timestamp in seconds
- Use timestamp links naturally within the content (2-3 links recommended)
- Example: "We discovered that [customer retention increased 40%](${fathomBaseUrl}?timestamp=245) when implementing this approach"

QUALITY CRITERIA:
- Start with a hook that grabs attention in the first line
- Provide genuine value (insight, lesson learned, or actionable tip)
- Include a clear call-to-action (comment, share, try something)
- Use short paragraphs and line breaks for readability
- Maintain a human, relatable voice (not overly corporate)
- Make it platform-agnostic (works for LinkedIn and Twitter)

OUTPUT FORMAT:
Generate the social post as markdown. Do NOT include a separate title - integrate the hook into the first line of the post itself.

Example structure:
---
Just learned something fascinating about [topic with timestamp link]...

[2-3 paragraphs of insight and value]

The key takeaway: [main lesson]

What's your experience with this? Drop a comment below.

#Hashtag1 #Hashtag2 #Hashtag3
---

Start writing the social post now:`
}

/**
 * Build prompt for blog articles
 * Target: 800-1500 words, professional, SEO-friendly
 */
export function buildBlogPrompt(options: PromptOptions): string {
  const { meetingTitle, meetingDate, topics, transcriptExcerpt, fathomBaseUrl } = options

  const topicsList = topics
    .map(
      (topic, i) =>
        `${i + 1}. ${topic.title}\n   ${topic.description}\n   [Timestamp: ${topic.timestamp_seconds}s]`
    )
    .join('\n\n')

  return `You are a professional content writer creating an in-depth blog article from a business meeting.

MEETING CONTEXT:
- Title: ${meetingTitle}
- Date: ${meetingDate}

SELECTED TOPICS:
${topicsList}

TRANSCRIPT EXCERPT:
${transcriptExcerpt}

TASK:
Create a comprehensive blog article that:
- Word count: 800-1500 words
- Tone: Professional but accessible, authoritative
- Structure: Headline → Introduction → 3-5 main sections → Conclusion with CTA
- Use subheadings (## and ###) to organize content
- Include actionable insights and practical advice
- SEO-friendly structure with natural keyword usage

IMPORTANT - TIMESTAMP LINKS:
- Reference specific insights, quotes, and examples from the transcript
- Include inline timestamp links using this exact format: [insight or quote](${fathomBaseUrl}?timestamp=X)
- Replace X with the actual timestamp in seconds
- Distribute timestamp links throughout the article (5-8 links recommended)
- Example: "During our discussion, we identified [three critical success factors](${fathomBaseUrl}?timestamp=342) for scaling operations"

CONTENT STRUCTURE:
1. **Compelling Headline**: Benefit-focused, clear value proposition
2. **Introduction (2-3 paragraphs)**: Hook the reader, preview key insights
3. **Main Body (3-5 sections with subheadings)**:
   - Each section covers one major topic or insight
   - Include specific examples and data points from the meeting
   - Link to relevant timestamp moments
   - Provide actionable takeaways
4. **Conclusion (2 paragraphs)**: Summarize key points, include call-to-action

QUALITY CRITERIA:
- Write in clear, scannable format (short paragraphs, bullet points when appropriate)
- Balance depth with readability
- Include specific, concrete examples from the meeting
- Provide value that makes the article worth bookmarking
- End with a strong call-to-action

OUTPUT FORMAT:
Generate the blog article as markdown with this structure:
---
# [Compelling Headline]

[Introduction paragraphs with hook]

## [First Major Section Heading]

[Content with insights and timestamp links]

## [Second Major Section Heading]

[Content with insights and timestamp links]

[Continue with additional sections...]

## Conclusion

[Summary and call-to-action]
---

Start writing the blog article now:`
}

/**
 * Build prompt for video scripts
 * Target: 300-500 words, engaging delivery, visual cues
 */
export function buildVideoPrompt(options: PromptOptions): string {
  const { meetingTitle, meetingDate, topics, transcriptExcerpt, fathomBaseUrl } = options

  const topicsList = topics
    .map(
      (topic, i) =>
        `${i + 1}. ${topic.title}\n   ${topic.description}\n   [Timestamp: ${topic.timestamp_seconds}s]`
    )
    .join('\n\n')

  return `You are a professional video scriptwriter creating an engaging video script from a business meeting.

MEETING CONTEXT:
- Title: ${meetingTitle}
- Date: ${meetingDate}

SELECTED TOPICS:
${topicsList}

TRANSCRIPT EXCERPT:
${transcriptExcerpt}

TASK:
Create a compelling video script that:
- Word count: 300-500 words (approx 2-3 minutes speaking time)
- Tone: Energetic, conversational, engaging for camera
- Structure: Strong hook → Main content → Call-to-action
- Include visual cues in [brackets] for editor
- Format as talking points with delivery notes
- Optimized for YouTube, LinkedIn Video, or short-form content

IMPORTANT - TIMESTAMP LINKS:
- Reference specific moments from the original meeting
- Include timestamp links using this exact format: [insight or reference](${fathomBaseUrl}?timestamp=X)
- Replace X with the actual timestamp in seconds
- Use 3-5 timestamp links in the description or as reference points
- Example: "Let me show you the exact moment we figured this out: [see this insight](${fathomBaseUrl}?timestamp=567)"

VIDEO SCRIPT STRUCTURE:
1. **HOOK (First 5 seconds)**: Grab attention immediately
2. **INTRO (15-20 seconds)**: Set context, preview value
3. **MAIN CONTENT (60-90 seconds)**: Key insights and takeaways
4. **CONCLUSION (15-20 seconds)**: Summarize and CTA

SCRIPT ELEMENTS TO INCLUDE:
- [VISUAL CUE]: Suggestions for what to show on screen
- [PAUSE]: Strategic pauses for emphasis
- **EMPHASIS**: Key words to stress when speaking
- Natural, conversational language (write how you'd speak, not formal writing)

QUALITY CRITERIA:
- Hook must be compelling enough to stop scrolling
- Use conversational language and contractions
- Include pattern interrupts and engagement hooks
- End with a clear, specific call-to-action
- Make it feel authentic and personal, not scripted

OUTPUT FORMAT:
Generate the video script as markdown with this structure:
---
# [Video Title: Compelling and Benefit-Focused]

## HOOK (0:00-0:05)
[VISUAL: Opening shot]
[Script with strong attention grabber]

## INTRO (0:05-0:25)
[VISUAL: Suggested visual]
[Introduction with context]

## MAIN CONTENT (0:25-2:00)
[VISUAL: Suggested visual]

**First key point:**
[Talking points with natural delivery]

[Include timestamp references to original meeting]

**Second key point:**
[More talking points]

## CONCLUSION (2:00-2:30)
[VISUAL: Closing shot]
[Summary and CTA]

---

SUGGESTED DESCRIPTION (for video platform):
[2-3 sentence description with timestamp links to original meeting]
---

Start writing the video script now:`
}

/**
 * Build prompt for email newsletters
 * Target: 400-600 words, scannable, valuable
 */
export function buildEmailPrompt(options: PromptOptions): string {
  const { meetingTitle, meetingDate, topics, transcriptExcerpt, fathomBaseUrl } = options

  const topicsList = topics
    .map(
      (topic, i) =>
        `${i + 1}. ${topic.title}\n   ${topic.description}\n   [Timestamp: ${topic.timestamp_seconds}s]`
    )
    .join('\n\n')

  return `You are a professional email newsletter writer creating valuable content from a business meeting.

MEETING CONTEXT:
- Title: ${meetingTitle}
- Date: ${meetingDate}

SELECTED TOPICS:
${topicsList}

TRANSCRIPT EXCERPT:
${transcriptExcerpt}

TASK:
Create an engaging email newsletter that:
- Word count: 400-600 words
- Tone: Professional but friendly, direct
- Structure: Personal greeting → Value up front → Scannable content → Clear CTA
- Use short paragraphs (2-3 sentences max)
- Include bullet points for easy scanning
- Optimized for mobile reading

IMPORTANT - TIMESTAMP LINKS:
- Reference specific insights and moments from the meeting
- Include inline timestamp links using this exact format: [insight or topic](${fathomBaseUrl}?timestamp=X)
- Replace X with the actual timestamp in seconds
- Use 3-5 timestamp links throughout the email
- Example: "In our recent discussion, we uncovered [a surprising finding about customer behavior](${fathomBaseUrl}?timestamp=423)"

EMAIL STRUCTURE:
1. **Subject Line**: Attention-grabbing, benefit-focused (write this as the title)
2. **Opening (1-2 lines)**: Personal, conversational greeting
3. **Value Hook (1 paragraph)**: Lead with the most valuable insight
4. **Main Content (2-3 sections)**:
   - Use subheadings for scannability
   - Short paragraphs
   - Bullet points where appropriate
5. **Call-to-Action**: Clear, specific next step

QUALITY CRITERIA:
- Put the most valuable information in the first 100 words
- Write like you're emailing a colleague (warm but professional)
- Make every paragraph earn its place (no fluff)
- Use bold for emphasis sparingly
- End with ONE clear call-to-action (don't overwhelm with options)
- Mobile-first: assume reader is on their phone

EMAIL FORMATTING TIPS:
- Use line breaks liberally (white space is your friend)
- One idea per paragraph
- Bullet points for lists of 3+ items
- Bold key insights or takeaways
- Include timestamp links as natural references

OUTPUT FORMAT:
Generate the email newsletter as markdown with this structure:
---
# [Subject Line: Compelling and Benefit-Focused]

Hi there,

[Opening line that connects personally]

[Value hook - lead with best insight]

## [First Section Heading]

[Content with short paragraphs and timestamp links]

## [Second Section Heading]

[More valuable content]

**Key takeaways:**
- [Bullet point 1]
- [Bullet point 2]
- [Bullet point 3]

[Call-to-action paragraph with clear next step]

[Friendly sign-off]

---
P.S. [Optional: Additional value or reminder]
---

Start writing the email newsletter now:`
}

/**
 * Main prompt builder - routes to specific content type
 */
export function buildContentPrompt(
  contentType: 'social' | 'blog' | 'video' | 'email',
  options: PromptOptions
): string {
  switch (contentType) {
    case 'social':
      return buildSocialPrompt(options)
    case 'blog':
      return buildBlogPrompt(options)
    case 'video':
      return buildVideoPrompt(options)
    case 'email':
      return buildEmailPrompt(options)
    default:
      throw new Error(`Unknown content type: ${contentType}`)
  }
}
