/**
 * Tone Settings Prompt Builder
 *
 * Builds tone instructions to inject into content generation prompts
 * based on user's per-content-type tone settings.
 */

export interface ToneSettings {
  tone_style: string
  formality_level: number
  emoji_usage: 'none' | 'minimal' | 'moderate' | 'liberal'
  brand_voice_description?: string
  sample_phrases?: string[]
  words_to_avoid?: string[]
  preferred_keywords?: string[]
  max_length_override?: number
  include_cta?: boolean
  cta_style?: string
}

/**
 * Build tone instruction block for prompts
 */
export function buildToneInstructions(settings: ToneSettings | null): string {
  if (!settings) {
    return '' // No custom tone settings, use default prompts
  }

  const instructions: string[] = []

  // Tone style
  if (settings.tone_style) {
    instructions.push(`TONE STYLE: Write in a ${settings.tone_style} tone.`)
  }

  // Formality level (1-10 scale)
  if (settings.formality_level) {
    const formalityDescriptions: Record<number, string> = {
      1: 'very casual and conversational, like texting a friend',
      2: 'casual and friendly, like chatting with a colleague',
      3: 'relaxed but clear, informal professional',
      4: 'approachable professional, friendly but polished',
      5: 'balanced professional, standard business tone',
      6: 'professional and polished, business formal',
      7: 'formal professional, corporate communications',
      8: 'highly formal, executive communications',
      9: 'very formal, legal/official tone',
      10: 'extremely formal, ceremonial/diplomatic',
    }
    const formality = formalityDescriptions[settings.formality_level] || formalityDescriptions[5]
    instructions.push(`FORMALITY: Use a ${formality} level of formality.`)
  }

  // Emoji usage
  if (settings.emoji_usage) {
    const emojiGuidelines: Record<string, string> = {
      none: 'Do NOT use any emojis in the content.',
      minimal: 'Use emojis sparingly - maximum 1-2 emojis only if they add genuine value.',
      moderate: 'Feel free to use emojis where appropriate to add personality (3-5 emojis).',
      liberal: 'Use emojis generously to make the content fun and engaging.',
    }
    instructions.push(`EMOJIS: ${emojiGuidelines[settings.emoji_usage]}`)
  }

  // Brand voice description
  if (settings.brand_voice_description) {
    instructions.push(`BRAND VOICE: ${settings.brand_voice_description}`)
  }

  // Sample phrases
  if (settings.sample_phrases && settings.sample_phrases.length > 0) {
    const phrases = settings.sample_phrases.slice(0, 5).join('", "')
    instructions.push(`SAMPLE PHRASES TO EMULATE: "${phrases}"`)
  }

  // Words to avoid
  if (settings.words_to_avoid && settings.words_to_avoid.length > 0) {
    const avoidWords = settings.words_to_avoid.join(', ')
    instructions.push(`WORDS/PHRASES TO AVOID: ${avoidWords}`)
  }

  // Preferred keywords
  if (settings.preferred_keywords && settings.preferred_keywords.length > 0) {
    const preferredWords = settings.preferred_keywords.join(', ')
    instructions.push(`PREFERRED KEYWORDS (incorporate naturally): ${preferredWords}`)
  }

  // Max length override
  if (settings.max_length_override && settings.max_length_override > 0) {
    instructions.push(`LENGTH: Keep the content under ${settings.max_length_override} words.`)
  }

  // CTA style
  if (settings.include_cta === false) {
    instructions.push('CALL-TO-ACTION: Do NOT include a call-to-action.')
  } else if (settings.cta_style) {
    const ctaStyles: Record<string, string> = {
      soft: 'Include a gentle, non-pushy call-to-action that invites engagement.',
      direct: 'Include a clear, direct call-to-action that tells the reader exactly what to do.',
      question: 'End with an engaging question that invites discussion.',
      none: 'Do not include a call-to-action.',
    }
    instructions.push(`CALL-TO-ACTION: ${ctaStyles[settings.cta_style] || ctaStyles.soft}`)
  }

  if (instructions.length === 0) {
    return ''
  }

  return `
---
CUSTOM TONE INSTRUCTIONS (IMPORTANT - Follow these guidelines):
${instructions.join('\n')}
---
`
}

/**
 * Get default tone settings for a content type
 */
export function getDefaultToneSettings(contentType: 'social' | 'blog' | 'video' | 'email'): ToneSettings {
  const defaults: Record<string, ToneSettings> = {
    social: {
      tone_style: 'conversational and engaging',
      formality_level: 4,
      emoji_usage: 'minimal',
      include_cta: true,
      cta_style: 'question',
    },
    blog: {
      tone_style: 'professional and authoritative',
      formality_level: 5,
      emoji_usage: 'none',
      include_cta: true,
      cta_style: 'soft',
    },
    video: {
      tone_style: 'energetic and conversational',
      formality_level: 3,
      emoji_usage: 'none', // Emojis don't work well in video scripts
      include_cta: true,
      cta_style: 'direct',
    },
    email: {
      tone_style: 'friendly and professional',
      formality_level: 5,
      emoji_usage: 'none',
      include_cta: true,
      cta_style: 'direct',
    },
  }

  return defaults[contentType] || defaults.blog
}

/**
 * Merge user settings with defaults
 */
export function mergeToneSettings(
  userSettings: Partial<ToneSettings> | null,
  contentType: 'social' | 'blog' | 'video' | 'email'
): ToneSettings {
  const defaults = getDefaultToneSettings(contentType)

  if (!userSettings) {
    return defaults
  }

  return {
    ...defaults,
    ...userSettings,
    // Handle arrays specially to allow empty arrays to override defaults
    sample_phrases: userSettings.sample_phrases !== undefined ? userSettings.sample_phrases : defaults.sample_phrases,
    words_to_avoid: userSettings.words_to_avoid !== undefined ? userSettings.words_to_avoid : defaults.words_to_avoid,
    preferred_keywords: userSettings.preferred_keywords !== undefined ? userSettings.preferred_keywords : defaults.preferred_keywords,
  }
}
